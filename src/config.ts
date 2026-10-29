const SAME_SITE = ['lax', 'strict', 'none'] as const

function sameSite(value = 'lax'): (typeof SAME_SITE)[number] {
  const match = SAME_SITE.find((option) => option === value)
  if (!match) {
    throw new Error(`COOKIE_SAMESITE must be one of ${SAME_SITE.join(', ')}`)
  }
  return match
}

export const config = {
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: sameSite(process.env.COOKIE_SAMESITE),
  },
  // Number of reverse proxies in front of the app; 0 means req.ip is the socket address.
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
}
