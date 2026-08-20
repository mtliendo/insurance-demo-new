import type { Metadata } from 'next'
import { Barlow, Chakra_Petch, IBM_Plex_Mono } from 'next/font/google'
import { Auth0Provider } from '@auth0/nextjs-auth0'
import { auth0 } from '@/lib/auth0'
import './globals.css'

/** Angular and tactical — headings read like S.H.I.E.L.D. paperwork. */
const chakra = Chakra_Petch({
  variable: '--font-chakra',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

/** Body copy: a grotesque with enough character to sit next to the display face. */
const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

/** Every machine-readable value in the app — policy numbers, IDs, counters. */
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Hero Shield Insurance',
  description: 'Not All Heroes Wear Capes, But All Heroes Need Coverage',
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Seeds useUser() so the nav renders signed-in on first paint instead of flashing.
  const session = await auth0.getSession()

  return (
    <html
      lang="en"
      className={`dark ${chakra.variable} ${barlow.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col">
        <Auth0Provider user={session?.user}>{children}</Auth0Provider>

        {/* Film grain over everything. Keeps the flat dark panels from looking
            like plastic, at a cost of one fixed layer. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[100] opacity-[0.16] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </body>
    </html>
  )
}
