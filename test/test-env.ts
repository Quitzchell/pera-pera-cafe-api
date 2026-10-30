if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for e2e tests')
}
const url = new URL(process.env.DATABASE_URL)
if (!url.pathname.endsWith('_test')) {
  url.pathname += '_test'
}
process.env.DATABASE_URL = url.toString()
process.env.FRONTEND_ORIGIN = 'http://app.test'
process.env.COOKIE_SECURE = 'false'
