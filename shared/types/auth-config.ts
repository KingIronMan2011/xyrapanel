export type CookieSameSite = 'lax' | 'strict' | 'none'

export interface RuntimeAuthConfig {
  tokenSecret?: string
  cookie?: {
    secure?: boolean
    sameSite?: CookieSameSite
    domain?: string
  }
}

export interface ExtendedRuntimeConfig {
  auth?: RuntimeAuthConfig
}

export interface AuthCookieOptions {
  secure: boolean
  sameSite: CookieSameSite
  domain?: string
}
