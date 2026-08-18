import Link from 'next/link'
import { Network, Rocket, Sparkles, Star, Shield, Wrench, Zap } from 'lucide-react'
import { HeroActions, SiteNav } from '@/components/site-nav'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

const COVERAGE = [
  {
    icon: Zap,
    accent: false,
    title: 'Hulk Damage',
    description: 'Vehicle and property damage from the big green guy',
    body: "Car totaled by an angry Hulk? We've got you covered. Our Hulk Damage Protection Plan includes full vehicle replacement and property restoration.",
  },
  {
    icon: Network,
    accent: true,
    title: 'Web-Slinger Accidents',
    description: 'Spiderman web-related incidents',
    body: 'Windshield covered in web? Visibility blocked? File a claim in minutes. Our fast-track process gets you back on the road quickly.',
  },
  {
    icon: Sparkles,
    accent: false,
    title: 'Sorcery & Portals',
    description: 'Dr. Strange dimensional damage',
    body: 'Portal opened in your living room? Mirror dimension damage? We understand magic. Our mystical damage assessors are trained in all dimensions.',
  },
  {
    icon: Zap,
    accent: true,
    title: 'Thunder God Weather',
    description: 'Thor and lightning strikes',
    body: "Thor's battle damaged your roof? Our Asgardian coverage has you protected. We handle everything from lightning strikes to Bifrost-related incidents.",
  },
  {
    icon: Wrench,
    accent: false,
    title: 'Tech Malfunction',
    description: 'Iron Man/Stark Tech collateral',
    body: 'Repulsor beam through your storefront? We cover all Stark Industries incidents. Our tech damage specialists understand advanced weaponry.',
  },
  {
    icon: Rocket,
    accent: true,
    title: 'Alien Invasions',
    description: 'Chitauri, Thanos incidents',
    body: "Full coverage for extraterrestrial encounters and interdimensional threats. When aliens attack, we're your first line of defense.",
  },
]

const TESTIMONIALS = [
  {
    initials: 'JD',
    name: 'John Delgado',
    role: 'Small Business Owner, Queens, NY',
    quote:
      "After Spider-Man's battle damaged my deli, Hero Shield processed my claim in 48 hours. They understood the unique circumstances and got me back in business fast!",
  },
  {
    initials: 'SM',
    name: 'Sarah Mitchell',
    role: 'Homeowner, Greenwich Village',
    quote:
      "When Doctor Strange's spell went wrong and created a portal in my apartment, I thought no one would believe me. Hero Shield's magic coverage saved me from bankruptcy.",
  },
  {
    initials: 'RC',
    name: 'Robert Chen',
    role: 'Auto Owner, Manhattan',
    quote:
      'The Hulk used my car as a weapon against the Abomination. Standard insurance denied me. Hero Shield had a specific Hulk Damage clause. Incredible service!',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <Badge variant="secondary" className="mb-4 text-sm">
              Protecting Earth and Beyond
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Protection When Heroes Collide With Your Life
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground mb-4 font-semibold">
              Not All Heroes Wear Capes, But All Heroes Need Coverage
            </p>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              When the Hulk throws your car, Spider-Man webs your windshield, or Doctor Strange
              opens a portal in your living room, Hero Shield Insurance has you covered.
              Comprehensive protection for all superhero-related incidents.
            </p>
            <HeroActions />
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="py-20 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Comprehensive Superhero Incident Coverage
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We understand that in the MCU, accidents happen. That&apos;s why we offer specialized
              coverage for every type of superhero incident.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COVERAGE.map(({ icon: Icon, accent, title, description, body }) => (
              <Card key={title} className="hover:shadow-lg transition-shadow animate-fade-in">
                <CardHeader>
                  <div
                    className={`h-12 w-12 rounded-lg flex items-center justify-center mb-4 ${
                      accent ? 'bg-accent/10' : 'bg-primary/10'
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${accent ? 'text-accent' : 'text-primary'}`} />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Real Heroes, Real Stories</h2>
            <p className="text-muted-foreground text-lg">
              See what our customers have to say about Hero Shield Insurance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ initials, name, role, quote }) => (
              <Card key={name} className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar>
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{name}</CardTitle>
                      <CardDescription className="text-xs">{role}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">&ldquo;{quote}&rdquo;</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">Hero Shield Insurance</span>
              </div>
              <p className="text-muted-foreground mb-2">
                Not All Heroes Wear Capes, But All Heroes Need Coverage
              </p>
              <p className="text-sm text-muted-foreground">
                Licensed in all 50 states and applicable MCU dimensions
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Coverage</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {['Hulk Damage', 'Web Accidents', 'Sorcery Claims', 'Alien Invasions'].map((x) => (
                  <li key={x}>
                    <Link href="/" className="hover:text-primary transition-colors">
                      {x}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {['Privacy Policy', 'Terms of Service', 'Coverage Details', 'FAQ'].map((x) => (
                  <li key={x}>
                    <Link href="/" className="hover:text-primary transition-colors">
                      {x}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="mb-6" />

          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground">
            <p>© 2026 Hero Shield Insurance. Covering Earth and Beyond.</p>
            <p className="mt-2 sm:mt-0">All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
