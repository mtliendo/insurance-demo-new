import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let client: NeonQueryFunction<false, false> | undefined

/**
 * Resolved on first query rather than at import time so a missing DATABASE_URL
 * surfaces as a clear runtime error instead of breaking the build.
 */
function connect(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.')
    }
    client = neon(url)
  }
  return client
}

export const sql: NeonQueryFunction<false, false> = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
) => connect()(strings, ...values)) as NeonQueryFunction<false, false>
