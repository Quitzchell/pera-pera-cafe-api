import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/auth.decorators'

// Liveness only, and deliberately dependency-free: Postgres being unreachable is
// not a reason to report this container unhealthy.
// Express answers HEAD from the GET handler, so probes work with either verb.
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' }
  }
}
