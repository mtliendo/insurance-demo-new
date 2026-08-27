import Link from 'next/link'
import {
  Activity,
  Network,
  Quote,
  Radio,
  Rocket,
  ShieldHalf,
  Sparkles,
  Star,
  Wrench,
  Zap,
} from 'lucide-react'
import { HeroActions, SiteNav } from '@/components/site-nav'
import { Reveal } from '@/components/reveal'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

/**
 * Each coverage line is keyed to an Infinity Stone whose color also happens to
 * read as the hero responsible: Hulk green, Spidey blue, sling-ring orange,
 * Mjolnir yellow, hot-rod red, Thanos purple. `stone` drives the card's whole
 * palette through the [data-stone] hook in globals.css.
 */
const COVERAGE = [
  {
    icon: Zap,
    stone: 'time',
    code: 'HS-01',
    title: 'Hulk Damage',
    description: 'Vehicle and property damage from the big green guy',
    body: "Car totaled by an angry Hulk? We've got you covered. Our Hulk Damage Protection Plan includes full vehicle replacement and property restoration.",
  },
  {
    icon: Network,
    stone: 'space',
    code: 'HS-02',
    title: 'Web-Slinger Accidents',
    description: 'Spider-Man web-related incidents',
    body: 'Windshield covered in web? Visibility blocked? File a claim in minutes. Our fast-track process gets you back on the road quickly.',
  },
  {
    icon: Sparkles,
    stone: 'soul',
    code: 'HS-03',
    title: 'Sorcery & Portals',
    description: 'Dr. Strange dimensional damage',
    body: 'Portal opened in your living room? Mirror dimension damage? We understand magic. Our mystical damage assessors are trained in all dimensions.',
  },
  {
    icon: Zap,
    stone: 'mind',
    code: 'HS-04',
    title: 'Thunder God Weather',
    description: 'Thor and lightning strikes',
    body: "Thor's battle damaged your roof? Our Asgardian coverage has you protected. We handle everything from lightning strikes to Bifrost-related incidents.",
  },
  {
    icon: Wrench,
    stone: 'reality',
    code: 'HS-05',
    title: 'Tech Malfunction',
    description: 'Iron Man / Stark Tech collateral',
    body: 'Repulsor beam through your storefront? We cover all Stark Industries incidents. Our tech damage specialists understand advanced weaponry.',
  },
  {
    icon: Rocket,
    stone: 'power',
    code: 'HS-06',
    title: 'Alien Invasions',
    description: 'Chitauri and Thanos-level events',
    body: "Full coverage for extraterrestrial encounters and interdimensional threats. When aliens attack, we're your first line of defense.",
  },
] as const

const TESTIMONIALS = [
  {
    initials: 'JD',
    name: 'John Delgado',
    role: 'Small Business Owner, Queens, NY',
    stone: 'space',
    quote:
      "After Spider-Man's battle damaged my deli, Hero Shield processed my claim in 48 hours. They understood the unique circumstances and got me back in business fast!",
  },
  {
    initials: 'SM',
    name: 'Sarah Mitchell',
    role: 'Homeowner, Greenwich Village',
    stone: 'soul',
    quote:
      "When Doctor Strange's spell went wrong and created a portal in my apartment, I thought no one would believe me. Hero Shield's magic coverage saved me from bankruptcy.",
  },
  {
    initials: 'RC',
    name: 'Robert Chen',
    role: 'Auto Owner, Manhattan',
    stone: 'time',
    quote:
      'The Hulk used my car as a weapon against the Abomination. Standard insurance denied me. Hero Shield had a specific Hulk Damage clause. Incredible service!',
  },
] as const

/** Scrolls across the top of the hero. Flavor, but it sets the tone instantly. */
const ALERTS = [
  'INCIDENT 4471 — Chitauri debris field, Midtown East — adjusters dispatched',
  'ADVISORY — Mirror-dimension overlap reported near Bleecker St',
  'INCIDENT 4472 — Unscheduled Bifrost touchdown, New Mexico — roof claims open',
  'NOTICE — Gamma event downtown; Hulk Damage claims fast-tracked 48h',
  'INCIDENT 4473 — Repulsor discharge, Stark Tower perimeter — no injuries',
  'ADVISORY — Web residue on I-495 windshields; mobile units deployed',
]

const STATS = [
  { value: '4,281', label: 'Claims settled', sub: 'Since the Battle of New York' },
  { value: '48h', label: 'Avg. resolution', sub: 'Portal claims included' },
  { value: '616', label: 'Primary sector', sub: 'Plus 12 adjacent realities' },
  { value: '24/7', label: 'Incident desk', sub: 'Someone is always awake' },
]

/** Fixed positions so the server and client render the same particles. */
const PARTICLES = [
  { top: '18%', left: '8%', size: 3, delay: '0s', color: 'var(--hud)' },
  { top: '62%', left: '14%', size: 2, delay: '1.4s', color: 'var(--gold)' },
  { top: '28%', left: '82%', size: 4, delay: '0.6s', color: 'var(--stone-soul)' },
  { top: '74%', left: '72%', size: 2, delay: '2.2s', color: 'var(--hud)' },
  { top: '44%', left: '46%', size: 2, delay: '3.1s', color: 'var(--stone-space)' },
  { top: '12%', left: '58%', size: 3, delay: '1.9s', color: 'var(--gold)' },
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* Incident ticker */}
      <div className="relative border-b border-border/60 bg-[oklch(0.17_0.03_266)]/80 py-2">
        <div className="marquee-mask overflow-hidden">
          <div className="animate-marquee flex w-max gap-10">
            {/* Two copies: the track translates -50% and loops seamlessly. */}
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 gap-10" aria-hidden={copy === 1}>
                {ALERTS.map((alert) => (
                  <span
                    key={alert}
                    className="hud-readout flex items-center gap-2 whitespace-nowrap text-[0.7rem] text-muted-foreground"
                  >
                    <Radio className="h-3 w-3 text-primary animate-blink" />
                    {alert}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Hero ---------------------------------------------------------- */}
      <section className="hud-grid relative overflow-hidden py-20 sm:py-28">
        {/* Sling-ring portal idling behind the instrument panel. */}
        <div className="portal-ring -right-40 top-10 h-[34rem] w-[34rem] opacity-40 blur-[1px]" />
        {/* Scan line drifting down the section. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-scan bg-gradient-to-r from-transparent via-hud to-transparent" />

        {PARTICLES.map((p, i) => (
          <span
            key={i}
            aria-hidden
            className="animate-float pointer-events-none absolute rounded-full"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 12px ${p.color}`,
              animationDelay: p.delay,
            }}
          />
        ))}

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_1fr]">
            {/* Copy */}
            <div>
              <div className="animate-rise mb-6 flex items-center gap-3">
                <Badge variant="hud">
                  <span className="h-1.5 w-1.5 rounded-full bg-hud animate-blink" />
                  Sector 616 · Active
                </Badge>
                <span className="hud-label text-muted-foreground">Est. 2012</span>
              </div>

              <h1 className="animate-rise stagger-1 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-5xl md:text-6xl">
                Protection when
                <br />
                <span className="bg-gradient-to-r from-primary via-gold to-hud bg-clip-text text-transparent text-glow">
                  heroes collide
                </span>
                <br />
                with your life
              </h1>

              <p className="animate-rise stagger-2 mt-6 max-w-xl text-lg text-foreground/85">
                Not all heroes wear capes, but all heroes need coverage.
              </p>

              <p className="animate-rise stagger-3 mt-3 max-w-xl text-muted-foreground">
                When the Hulk throws your car, Spider-Man webs your windshield, or Doctor
                Strange opens a portal in your living room, Hero Shield has you covered.
                Comprehensive protection for every superhero-related incident.
              </p>

              <div className="animate-rise stagger-4 mt-9">
                <HeroActions />
              </div>

              <div className="animate-rise stagger-5 mt-10 flex flex-wrap gap-x-8 gap-y-3">
                {['No cape discrimination', 'Interdimensional adjusters', 'AI claims intake'].map(
                  (item) => (
                    <span
                      key={item}
                      className="hud-readout flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="h-1 w-1 rotate-45 bg-gold" />
                      {item}
                    </span>
                  ),
                )}
              </div>
            </div>

            {/* Instrument panel */}
            <div className="animate-rise stagger-3">
              <div className="hud-panel hud-brackets p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <span className="hud-label">Threat Monitor</span>
                  <span className="hud-readout flex items-center gap-1.5 text-[0.7rem] text-stone-time">
                    <span className="h-1.5 w-1.5 rounded-full bg-stone-time animate-blink" />
                    LIVE
                  </span>
                </div>

                <div className="mb-8 flex justify-center">
                  <div className="arc-reactor h-28 w-28">
                    <ShieldHalf className="relative z-10 h-8 w-8 text-[oklch(0.16_0.03_266)]" />
                  </div>
                </div>

                <dl className="space-y-3">
                  {[
                    { k: 'Coverage lines', v: '06 / 06', stone: 'time' },
                    { k: 'Open incidents', v: '17', stone: 'mind' },
                    { k: 'Adjusters deployed', v: '42', stone: 'space' },
                    { k: 'Realities monitored', v: '13', stone: 'power' },
                  ].map(({ k, v, stone }) => (
                    <div
                      key={k}
                      data-stone={stone}
                      className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0"
                    >
                      <dt className="hud-readout text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="hud-readout text-sm font-semibold text-[var(--stone)]">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6">
                  <div className="mb-1.5 flex justify-between">
                    <span className="hud-label text-[0.6rem]">System integrity</span>
                    <span className="hud-readout text-[0.7rem] text-hud">98%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      data-stone="space"
                      className="energy-fill h-full rounded-full"
                      style={{ width: '98%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Stats band ----------------------------------------------------- */}
      <section className="border-y border-border/60 bg-[oklch(0.16_0.03_266)]/60">
        <div className="container mx-auto grid grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 80}>
              <div className="group px-2 py-8 text-center lg:py-10">
                <div className="font-display text-3xl font-bold text-gold transition-all duration-300 group-hover:text-glow sm:text-4xl">
                  {stat.value}
                </div>
                <div className="hud-label mt-2">{stat.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.sub}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- Coverage ------------------------------------------------------- */}
      <section className="relative py-20 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-14 max-w-2xl">
            <span className="hud-label">Coverage Matrix</span>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              Six lines. Every kind of collateral.
            </h2>
            <p className="mt-4 text-muted-foreground">
              In the MCU, accidents happen at scale. Each of our coverage lines is
              underwritten for a specific class of incident — and staffed by adjusters who
              have seen it before.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {COVERAGE.map(({ icon: Icon, stone, code, title, description, body }, i) => (
              <Reveal key={title} delay={i * 70} className="h-full">
                <Card
                  data-stone={stone}
                  className="hud-panel hud-brackets group h-full rounded-none border-transparent p-px transition-all duration-500 hover:-translate-y-1.5 hover:glow-stone"
                >
                  {/* Top rule that charges to full stone color on hover. */}
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--stone)] opacity-40 transition-opacity duration-500 group-hover:opacity-100" />

                  <CardHeader className="pb-3">
                    <div className="mb-4 flex items-start justify-between">
                      <span className="relative grid h-12 w-12 place-items-center rounded-md bg-[color-mix(in_oklch,var(--stone)_16%,transparent)] ring-1 ring-[color-mix(in_oklch,var(--stone)_35%,transparent)] transition-all duration-500 group-hover:ring-[var(--stone)] group-hover:shadow-[0_0_24px_-4px_var(--stone)]">
                        <Icon className="h-6 w-6 text-[var(--stone)] transition-transform duration-500 group-hover:scale-110" />
                      </span>
                      <span className="hud-readout text-[0.7rem] text-muted-foreground/70">
                        {code}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-semibold">{title}</h3>
                    <p className="hud-readout text-[0.7rem] uppercase tracking-[0.1em] text-[var(--stone)]">
                      {description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Testimonials --------------------------------------------------- */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="portal-ring -left-52 top-1/4 h-[28rem] w-[28rem] opacity-20" />

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-14 max-w-2xl">
            <span className="hud-label">Field Reports</span>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              Real heroes, real stories
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map(({ initials, name, role, quote, stone }, i) => (
              <Reveal key={name} delay={i * 90} className="h-full">
                <Card
                  data-stone={stone}
                  className="group h-full transition-all duration-500 hover:-translate-y-1 hover:border-[color-mix(in_oklch,var(--stone)_50%,transparent)]"
                >
                  <CardHeader>
                    <Quote className="mb-3 h-7 w-7 text-[var(--stone)] opacity-50 transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className="animate-pop h-3.5 w-3.5 fill-gold text-gold"
                          style={{ animationDelay: `${i * 90 + s * 60}ms` }}
                        />
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-6">
                    <p className="text-sm leading-relaxed text-foreground/85">
                      &ldquo;{quote}&rdquo;
                    </p>
                    <div className="mt-6 flex items-center gap-3 border-t border-border/60 pt-4">
                      <Avatar className="h-9 w-9 ring-1 ring-[color-mix(in_oklch,var(--stone)_45%,transparent)]">
                        <AvatarFallback className="bg-secondary font-mono text-[0.7rem] text-[var(--stone)]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-display text-sm font-semibold">{name}</div>
                        <div className="text-xs text-muted-foreground">{role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Closing CTA ---------------------------------------------------- */}
      <section className="relative py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="hud-panel hud-brackets relative overflow-hidden px-6 py-14 text-center sm:px-12">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/12 via-transparent to-hud/12" />
              <Activity className="relative mx-auto mb-5 h-8 w-8 text-primary animate-blink" />
              <h2 className="relative font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                Something super happened to your car?
              </h2>
              <p className="relative mx-auto mt-3 max-w-lg text-muted-foreground">
                Our AI claims assistant takes the report, and a seated CIBA board
                clears it over email while you watch.
              </p>
              <div className="relative mt-8 flex justify-center">
                <HeroActions />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- Footer --------------------------------------------------------- */}
      <footer className="border-t border-border/60 bg-[oklch(0.155_0.03_266)]/70 py-14">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <span className="relative grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-transparent ring-1 ring-primary/40">
                  <ShieldHalf className="h-5 w-5 text-primary" />
                </span>
                <span className="font-display text-lg font-bold uppercase tracking-[0.08em]">
                  Hero Shield Insurance
                </span>
              </div>
              <p className="mb-3 max-w-sm text-sm text-muted-foreground">
                Not all heroes wear capes, but all heroes need coverage.
              </p>
              <p className="hud-readout text-xs text-muted-foreground/70">
                Licensed in all 50 states and 13 applicable MCU dimensions
              </p>
            </div>

            <FooterColumn
              heading="Coverage"
              items={['Hulk Damage', 'Web Accidents', 'Sorcery Claims', 'Alien Invasions']}
            />
            <FooterColumn
              heading="Company"
              items={['Privacy Policy', 'Terms of Service', 'Coverage Details', 'FAQ']}
            />
          </div>

          <div className="flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
            <p className="hud-readout">© 2026 Hero Shield Insurance · Covering Earth and beyond</p>
            <p className="hud-readout">All rights reserved</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterColumn({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div>
      <h3 className="hud-label mb-4">{heading}</h3>
      <ul className="space-y-2.5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>
            <Link
              href="/"
              className="group inline-flex items-center gap-2 transition-colors hover:text-hud"
            >
              <span className="h-px w-0 bg-hud transition-all duration-300 group-hover:w-3" />
              {item}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
