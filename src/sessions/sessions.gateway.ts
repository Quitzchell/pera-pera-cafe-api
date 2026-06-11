import {Logger} from '@nestjs/common'
import {
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage, MessageBody,
} from '@nestjs/websockets'
import {Server, Socket} from 'socket.io'
import {PrismaService} from '../prisma/prisma.service'
import {Prisma} from '../../generated/prisma/client'
import {SessionsService} from "./sessions.service"
import {GameplayService} from "./gameplay.service";

type HandshakeAuth = {
    sessionId?: string
    participantId?: string
}

type ParticipantWithSession = Prisma.ParticipantGetPayload<{ include: { session: true } }>

@WebSocketGateway({
    cors: {origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173'},
    path: '/api/socket.io/',
})
export class SessionsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(SessionsGateway.name)

    @WebSocketServer()
    server: Server

    constructor(
        private readonly prisma: PrismaService,
        private readonly sessionService: SessionsService,
        private readonly gameplayService: GameplayService,
    ) {
    }

    async handleConnection(@ConnectedSocket() client: Socket) {
        const {sessionId, participantId} = client.handshake.auth as HandshakeAuth

        if (!sessionId || !participantId) {
            this.logger.warn(`Socket ${client.id} rejected: missing auth`)
            client.disconnect()
            return
        }

        const participant = await this.prisma.participant.findFirst({
            where: {id: participantId, session_id: sessionId},
        })

        if (!participant) {
            this.logger.warn(`Socket ${client.id} rejected: invalid pair`)
            client.disconnect()
            return
        }

        client.data.sessionId = sessionId
        client.data.participantId = participantId
        client.data.isHost = participant.is_host

        await client.join(sessionId)

        // Send existing presence to the new client
        const presence = await this.collectPresence(sessionId)
        client.emit('presence:list', presence)

        const sess = await this.prisma.session.findUnique({
            where: {id: sessionId},
            select: {status: true}
        })
        if (sess) {
            client.emit('session:status', {status: sess.status})
        }
        if (sess && sess.status === 'active') {
            const dealerId = await this.gameplayService.getCurrentDealer(sessionId)
            const currentCard = await this.gameplayService.getCurrentCard(sessionId)
            client.emit('game:state', {dealerId, currentCard})
        }


        // Broadcast this participant's arrival to others in the room
        const payload = await this.getParticipantPayload(sessionId, participantId)
        if (payload) {
            client.to(sessionId).emit('participant:joined', payload)
        }

        this.logger.log(
            `Socket ${client.id} authenticated as ${participantId} in session ${sessionId} (host: ${participant.is_host})`,
        )
    }

    handleDisconnect(@ConnectedSocket() client: Socket) {
        const {sessionId, participantId} = client.data ?? {}

        if (sessionId && participantId) {
            this.server.to(sessionId).emit('participant:left', {participantId})
            this.logger.log(`Socket disconnected: ${client.id} (was ${participantId} in ${sessionId})`)
        } else {
            this.logger.log(`Socket ${client.id} disconnected (no auth)`)
        }
    }

    private async collectPresence(sessionId: string) {
        const sockets = await this.server.in(sessionId).fetchSockets()
        const connectedIds = Array.from(
            new Set(
                sockets
                    .map((s) => s.data.participantId as string | undefined)
                    .filter((id): id is string => !!id),
            ),
        )

        if (connectedIds.length === 0) return []

        const participants = await this.prisma.participant.findMany({
            where: {id: {in: connectedIds}, session_id: sessionId},
            include: {session: true},
        })

        return participants.map((p) => this.toPayload(p))
    }

    @SubscribeMessage('session:start')
    async onSessionStart(@ConnectedSocket() client: Socket) {
        const {sessionId, participantId} = client.data ?? {}
        if (!sessionId || !participantId) {
            return {ok: false, error: 'Not authenticated'}
        }

        try {
            await this.sessionService.startSession(sessionId, participantId)
            const dealerId = await this.gameplayService.getCurrentDealer(sessionId)
            this.server.to(sessionId).emit('session:started', {dealerId})
            return {ok: true}
        } catch (err) {
            return {ok: false, error: err instanceof Error ? err.message : 'Unknown error'}
        }
    }

    @SubscribeMessage('session:end')
    async onSessionEnd(@ConnectedSocket() client: Socket) {
        const {sessionId, participantId} = client.data ?? {}
        if (!sessionId || !participantId) {
            return {ok: false, error: 'Not authenticated'}
        }

        try {
            await this.sessionService.endSession(sessionId, participantId)
            this.server.to(sessionId).emit('session:ended', {})
            return {ok: true}
        } catch (err) {
            return {ok: false, error: err instanceof Error ? err.message : 'Unknown error'}
        }
    }

    @SubscribeMessage('card:draw')
    async onCardDraw(@ConnectedSocket() client: Socket, @MessageBody() data: { targetId: string }) {
        const {sessionId, participantId} = client.data ?? {}
        if (!sessionId || !participantId) return {ok: false, error: 'Not authenticated'}
        if (!data?.targetId) return {ok: false, error: 'targetId required'}

        try {
            const card = await this.gameplayService.drawCard(sessionId, participantId, data.targetId)
            this.server.to(sessionId).emit('card:drawn', card)
            return {ok: true}
        } catch (err) {
            return {ok: false, error: err instanceof Error ? err.message : 'Unknown error'}
        }
    }

    @SubscribeMessage('card:skip')
    async onCardSkip(@ConnectedSocket() client: Socket) {
        const {sessionId, participantId} = client.data ?? {}
        if (!sessionId || !participantId) return {ok: false, error: 'Not authenticated'}

        try {
            const card = await this.gameplayService.skipCard(sessionId, participantId)
            // skipCard internally draws a new card; broadcast the new card
            this.server.to(sessionId).emit('card:drawn', card)
            return {ok: true}
        } catch (err) {
            return {ok: false, error: err instanceof Error ? err.message : 'Unknown error'}
        }
    }

    @SubscribeMessage('turn:pass')
    async onTurnPass(@ConnectedSocket() client: Socket) {
        const {sessionId, participantId} = client.data ?? {}
        if (!sessionId || !participantId) return {ok: false, error: 'Not authenticated'}

        try {
            const {nextDealerId} = await this.gameplayService.passTurn(sessionId, participantId)
            this.server.to(sessionId).emit('turn:passed', {nextDealerId})
            return {ok: true}
        } catch (err) {
            return {ok: false, error: err instanceof Error ? err.message : 'Unknown error'}
        }
    }

    private async getParticipantPayload(sessionId: string, participantId: string) {
        const participant = await this.prisma.participant.findFirst({
            where: {id: participantId, session_id: sessionId},
            include: {session: true},
        })
        if (!participant) return null
        return this.toPayload(participant)
    }

    private toPayload(p: ParticipantWithSession) {
        const targetLanguage = p.session.languages.find((l) => l !== p.native_language)
        return {
            id: p.id,
            sessionId: p.session_id,
            name: p.name,
            nativeLanguage: p.native_language,
            targetLanguage,
            proficiencyLevels: p.proficiency_levels,
            isHost: p.is_host,
            joinedAt: p.joined_at,
            leftAt: p.left_at,
        }
    }
}
