import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import { Response } from 'express'
import { STATUS_CODES } from 'node:http'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()
    if (!(exception instanceof HttpException)) {
      this.logger.error(exception)
      response.status(500).json({
        statusCode: 500,
        error: STATUS_CODES[500],
        message: 'Internal server error',
      })
      return
    }

    const statusCode = exception.getStatus()
    const body = exception.getResponse()
    const message = typeof body === 'object' && 'message' in body ? body.message : exception.message
    response.status(statusCode).json({ statusCode, error: STATUS_CODES[statusCode], message })
  }
}
