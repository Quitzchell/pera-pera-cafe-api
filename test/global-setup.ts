import { execSync } from 'node:child_process'
import './test-env'

export default function globalSetup() {
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' })
}
