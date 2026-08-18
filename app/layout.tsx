import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Auth0Provider } from '@auth0/nextjs-auth0'
import { auth0 } from '@/lib/auth0'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Auth0Provider user={session?.user}>{children}</Auth0Provider>
      </body>
    </html>
  )
}
