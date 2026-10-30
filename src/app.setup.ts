import { ValidationPipe } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { config } from './config'
import { HttpExceptionFilter } from './http-exception.filter'

export function configureApp(app: NestExpressApplication) {
  app.set('trust proxy', config.trustProxy)
  app.enableCors({ origin: config.frontendOrigins, credentials: true })
  app.use(cookieParser())
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())
  app.setGlobalPrefix('api')
}
