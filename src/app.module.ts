import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { VerbsModule } from './verbs/verbs.module'
import { SettingsModule } from './settings/settings.module'
import { DrillModule } from './drill/drill.module'
import { ProgressModule } from './progress/progress.module'

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    VerbsModule,
    SettingsModule,
    DrillModule,
    ProgressModule,
  ],
})
export class AppModule {}
