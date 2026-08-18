'use client'

import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0'
import { FileText, LogIn, LogOut, Shield, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function SiteNav() {
  const { user, isLoading } = useUser()

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Hero Shield Insurance</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
              Home
            </Link>
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
              Coverage
            </Link>
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
              About
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isLoading ? null : user ? (
              <>
                <Button asChild variant="default" className="hidden sm:inline-flex">
                  <Link href="/file-claim">
                    <FileText className="h-4 w-4 mr-2" />
                    File a Claim
                  </Link>
                </Button>
                <Link href="/profile">
                  <Avatar className="h-9 w-9 cursor-pointer hover:ring-2 ring-primary transition-all">
                    <AvatarImage src={user.picture ?? undefined} alt={user.name ?? 'User'} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <Button asChild variant="ghost" size="sm">
                  <a href="/auth/logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </a>
                </Button>
              </>
            ) : (
              <Button asChild>
                <a href="/auth/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  Login
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

/** Hero CTA — needs the session to decide between "get covered" and "file a claim". */
export function HeroActions() {
  const { user, isLoading } = useUser()

  if (isLoading) return null

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Button
        asChild
        size="lg"
        className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
      >
        {user ? (
          <Link href="/file-claim">File a Claim</Link>
        ) : (
          <a href="/auth/login">Get Covered Today</a>
        )}
      </Button>
      {user && (
        <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6">
          <Link href="/profile">View Coverage</Link>
        </Button>
      )}
    </div>
  )
}
