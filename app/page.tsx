import Link from "next/link";
import HeroWhisper from "@/components/HeroWhisper";
import Reveal from "@/components/Reveal";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* ---------- NAV ---------- */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo href={null} size="md" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#confessions" className="transition-colors hover:text-foreground">Confessions</a>
            <a href="#communities" className="transition-colors hover:text-foreground">Communities</a>
            <a href="#safety" className="transition-colors hover:text-foreground">Safety</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-20 text-center lg:pt-24">
        <Reveal>
          <p className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            🔒 AI Moderated • Anonymous by Design
          </p>
        </Reveal>

        <Reveal delay={60}>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            The internet&apos;s safe space for anonymous conversations
          </h1>
        </Reveal>

        <Reveal delay={120}>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Share confessions, receive anonymous messages, join communities, and
            speak freely — without ever revealing your identity.
            No real names.No phone number.No followers.


          </p>
        </Reveal>

        <Reveal delay={180}>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Get Your Anonymous Identity
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/feed"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border px-7 text-foreground transition-colors hover:bg-card"
            >
              Explore confessions
            </Link>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <p className="mt-7 text-sm text-muted-foreground">
            <span className="tracking-wide text-primary">★</span> Loved by people who want
            to be heard, not seen
          </p>
        </Reveal>

        {/* ---------- HERO SHOWCASE (3 columns) ---------- */}
        <Reveal delay={300}>
          <div className="mt-16 grid grid-cols-1 gap-4 text-left md:grid-cols-3">
            {/* LEFT — anonymous inbox */}
            <ShowcaseCard title="Anonymous inbox" icon="✉️">
              <div className="space-y-2.5">
                {[
                  { who: "Someone", msg: "You inspire me more than you know.", emoji: "💜" },
                  { who: "Anonymous", msg: "How do you stay productive?", emoji: "🤔" },
                ].map((m) => (
                  <div key={m.msg} className="rounded-2xl border border-border bg-background/40 p-3">
                    <p className="text-[11px] text-muted-foreground">{m.who}</p>
                    <p className="mt-0.5 flex items-start justify-between gap-2 text-sm">
                      <span>{m.msg}</span>
                      <span>{m.emoji}</span>
                    </p>
                  </div>
                ))}
              </div>
            </ShowcaseCard>

            {/* CENTER — trending confessions */}
            <ShowcaseCard title="Trending confessions" icon="🔥" featured>
              <div className="space-y-2.5">
                {[
                  { msg: "I quit my job today and nobody knows.", likes: "1.2K" },
                  { msg: "I want to change careers but I'm scared.", likes: "842" },
                  { msg: "Nobody knows I'm building a company after work.", likes: "2.1K" },
                ].map((c) => (
                  <div key={c.msg} className="rounded-2xl border border-border bg-background/40 p-3">
                    <p className="text-sm leading-5">{c.msg}</p>
                    <p className="mt-1.5 text-xs text-primary">❤️ {c.likes}</p>
                  </div>
                ))}
              </div>
            </ShowcaseCard>

            {/* RIGHT — popular communities */}
            <ShowcaseCard title="Popular communities" icon="🌐">
              <ul className="space-y-2">
                {[
                  ["🚀", "Founder Circle"],
                  ["🎓", "Students Nepal"],
                  ["❤️", "Relationship Advice"],
                  ["🤖", "AI Builders"],
                  ["💻", "Developers Hub"],
                ].map(([icon, name]) => (
                  <li
                    key={name}
                    className="flex items-center gap-2.5 rounded-2xl border border-border bg-background/40 px-3 py-2 text-sm"
                  >
                    <span>{icon}</span>
                    {name}
                  </li>
                ))}
              </ul>
            </ShowcaseCard>
          </div>
        </Reveal>
      </section>

      {/* ---------- STATS BAR ---------- */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-6 py-10 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 70}>
              <div className="text-center">
                <p className="font-display text-2xl font-medium text-primary sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="eyebrow">Everything in one place</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              Six ways to speak freely
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">
              Confess, connect, ask and talk — all without revealing who you are.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 90}>
              <Link
                href={f.href}
                className="group relative flex h-full flex-col bg-card p-8 transition-colors hover:bg-secondary/40"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-xl ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-primary/15">
                    {f.icon}
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      f.status === "live"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-background/40 text-muted-foreground"
                    }`}
                  >
                    {f.status === "live" ? "Live" : "Soon"}
                  </span>
                </div>
                <h3 className="font-display text-xl font-medium transition-colors group-hover:text-primary">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.body}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- TRENDING CONFESSIONS ---------- */}
      <section id="confessions" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="eyebrow">Straight from the feed</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              Trending confessions
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">
              This is what people say when no one
              knows who they are.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRENDING.map((c, i) => (
            <Reveal key={c.msg} delay={(i % 3) * 80}>
              <div className="flex h-full flex-col justify-between rounded-3xl border border-border bg-card p-6 transition-colors hover:border-primary/20">
                <p className="text-sm leading-7 text-foreground/90">&ldquo;{c.msg}&rdquo;</p>
                <p className="mt-5 text-sm text-primary">❤️ {c.likes}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-10 text-center">
            <Link
              href="/feed"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm text-foreground transition-colors hover:bg-card"
            >
              See all confessions →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ---------- POPULAR COMMUNITIES ---------- */}
      <section id="communities" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="eyebrow">Find your people</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              Popular communities
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">
              Anonymous spaces built around what matters to you.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMMUNITIES.map((c, i) => (
            <Reveal key={c.name} delay={(i % 3) * 80}>
              <Link
                href="/communities"
                className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/20 hover:bg-secondary/40"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-xl ring-1 ring-inset ring-primary/10">
                  {c.icon}
                </span>
                <div>
                  <h3 className="font-display text-lg font-medium transition-colors group-hover:text-primary">
                    {c.name}
                  </h3>
                  <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{c.desc}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- AI SAFETY ---------- */}
      <section id="safety" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] border border-border bg-card px-7 py-12 sm:px-12 sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-primary/10 blur-[110px]"
            />
            <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="eyebrow">AI safety first</p>
                <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
                  Powered by AI. Protected for you.
                </h2>
                <p className="mt-4 leading-7 text-muted-foreground">
                  Every confession, message, comment and chat is scanned in real
                  time to keep Sera safe — without silencing honest struggle.
                </p>
                <ul className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {SAFETY.map((s) => (
                    <li key={s} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] text-primary">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <Reveal delay={120}>
                <div className="rounded-3xl border border-border bg-background/40 p-6">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <span className="relative inline-flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    Real-time monitoring active
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
                      <p className="text-[11px] text-primary">✓ Allowed — personal struggle</p>
                      <p className="mt-1 text-sm">&ldquo;I&apos;ve been feeling really lost lately.&rdquo;</p>
                    </div>
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-[11px] text-destructive">✕ Blocked — harassment</p>
                      <p className="mt-1 text-sm text-muted-foreground">Content that targets or harms others</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              It&apos;s simple. It&apos;s anonymous.
            </h2>
          </div>
        </Reveal>

        <div className="relative">
          <div className="absolute left-0 right-0 top-6 hidden lg:block">
            <div className="hush-divider mx-auto w-3/4" />
          </div>

          <ol className="relative grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <li className="text-center">
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-card text-xl">
                    {s.icon}
                  </div>
                  <h3 className="font-display text-lg font-medium">
                    {i + 1}. {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      <section id="testimonials" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="eyebrow">In their words</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              What people are saying
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.role} delay={i * 110}>
              <figure className="flex h-full flex-col rounded-3xl border border-border bg-card p-7 transition-colors hover:border-primary/20">
                <span className="font-display text-4xl leading-none text-primary/40">&ldquo;</span>
                <blockquote className="mt-2 flex-1 text-sm leading-7 text-foreground/90">{t.quote}</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm">{t.emoji}</span>
                  <span className="block text-sm font-medium text-muted-foreground">— {t.role}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 px-6 py-20">
        <Reveal>
          <div className="mb-12 text-center">
            <p className="eyebrow">Frequently asked</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              Good questions, honest answers
            </h2>
          </div>
        </Reveal>

        <Reveal>
          <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
            {FAQS.map((f) => (
              <details key={f.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                  {f.q}
                  <span className="text-muted-foreground transition-transform duration-300 group-open:rotate-180">⌄</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] border border-border bg-card px-8 py-14 text-center sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 h-72 w-160 max-w-full -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
            />
            <div className="relative mx-auto max-w-xl">
              <h2 className="font-display text-3xl font-medium tracking-tight sm:text-5xl">
                Say what you can&apos;t say anywhere else.
              </h2>
              <p className="mx-auto mt-5 max-w-md leading-7 text-muted-foreground">
                Join people already using Sera to connect, confess and feel heard —
                anonymously.
              </p>
              <Link
                href="/signup"
                className="group mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Join Sera free
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <p className="mt-4 text-xs text-muted-foreground/70">No credit card required.</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-border">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-6 py-14 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Logo href={null} size="sm" />
            <p className="mt-3 max-w-56 text-sm leading-6 text-muted-foreground">
              Speak freely. Stay unseen.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              { label: "Confessions", href: "/feed" },
              { label: "Communities", href: "/communities" },
              { label: "Anonymous Chat", href: "/chat" },
              { label: "Inbox", href: "/inbox" },
            ]}
          />
          <FooterCol
            title="Account"
            links={[
              { label: "Sign up", href: "/signup" },
              { label: "Sign in", href: "/login" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Guidelines", href: "/guidelines" },
            ]}
          />
        </div>
        <div className="border-t border-border">
          <p className="mx-auto w-full max-w-6xl px-6 py-6 text-center text-xs text-muted-foreground/70">
            © 2026 Sera. Speak freely. Stay unseen.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ---------- hero showcase card ---------- */
function ShowcaseCard({
  title,
  icon,
  featured,
  children,
}: {
  title: string;
  icon: string;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border bg-card/80 p-5 backdrop-blur ${
        featured
          ? "border-primary/30 shadow-2xl shadow-black/40 md:-translate-y-3"
          : "border-border"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <p className="text-sm font-medium">{title}</p>
      </div>
      {children}
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- content ---------- */
const STATS = [
  { value: "Anonymous", label: "Messages exchanged daily" },
  { value: "Open", label: "Confessions shared freely" },
  { value: "Growing", label: "Communities to join" },
  { value: "99.8%", label: "Safe conversations" },
];

const FEATURES = [
  {
    icon: "✉️",
    title: "Anonymous messages",
    body: "Share your link and receive honest feedback from anyone — they stay hidden, so do you.",
    href: "/inbox",
    status: "live",
  },
  {
    icon: "💭",
    title: "Confessions",
    body: "Share what you can’t say publicly to an open feed. No name attached — just the thought.",
    href: "/feed",
    status: "live",
  },
  {
    icon: "🌐",
    title: "Communities",
    body: "Find people who understand you. Start or join an anonymous space for anything.",
    href: "/communities",
    status: "live",
  },
  {
    icon: "💬",
    title: "Anonymous chat",
    body: "Talk privately, one-on-one in real time, without any identity pressure.",
    href: "/chat",
    status: "live",
  },
  {
    icon: "🛡️",
    title: "AI protection",
    body: "AI blocks spam, bullying and toxic content in real time — while letting honest struggle through.",
    href: "/feed",
    status: "live",
  },
  {
    icon: "⭐",
    title: "Reputation system",
    body: "Build trust over time without ever revealing who you are.",
    href: "/signup",
    status: "soon",
  },
];

const TRENDING = [
  { msg: "My startup has made $0 in 8 months.", likes: "1.3K" },
  { msg: "I feel lonely even when I'm around people.", likes: "982" },
  { msg: "I wish I could tell my parents the truth.", likes: "1.1K" },
  { msg: "I'm afraid I'm not good enough.", likes: "876" },
  { msg: "Sometimes I pretend I'm okay for everyone.", likes: "1.4K" },
  { msg: "I quit my job today and nobody knows.", likes: "1.2K" },
];

const COMMUNITIES = [
  { icon: "🚀", name: "Founder Circle", desc: "Safe space for founders." },
  { icon: "🎓", name: "Students Nepal", desc: "Anonymous student discussions." },
  { icon: "❤️", name: "Relationship Advice", desc: "Dating and life advice." },
  { icon: "🤖", name: "AI Builders", desc: "Build AI together anonymously." },
  { icon: "💻", name: "Developers Hub", desc: "Coding discussions." },
  { icon: "🧠", name: "Mental Health", desc: "Support and understanding." },
];

const SAFETY = [
  "Toxic content detection",
  "Spam protection",
  "Harassment prevention",
  "Hate speech filtering",
  "Real-time monitoring",
  "Personal struggle allowed",
];

const STEPS = [
  { icon: "🧑", title: "Create your Sera ID", body: "Get an anonymous identity in seconds. No real name required." },
  { icon: "🔗", title: "Share or join", body: "Share your link or join communities that fit you." },
  { icon: "💬", title: "Confess, chat, ask", body: "Express yourself freely across every part of Sera." },
  { icon: "🔒", title: "Stay anonymous", body: "Your identity is never tied to anything you say." },
];

const TESTIMONIALS = [
  { quote: "Sera is the first place I can be honest.", role: "Student", emoji: "🦋" },
  { quote: "Finally a platform where people tell the truth.", role: "Creator", emoji: "🎬" },
  { quote: "As a founder, this helps me understand what people really think.", role: "Startup Founder", emoji: "🚀" },
];

const FAQS = [
  { q: "Is Sera really anonymous?", a: "Yes. You're given a random sera-XXXX identity and nothing you post is tied to a real name. Senders never see you, and you never see them." },
  { q: "Do I need a phone number?", a: "No. You sign up with just an email and password — no phone number, no real name. Or go fully anonymous with no email at all." },
  { q: "Can someone find my identity?", a: "No. There's nothing tying your messages back to a real identity. We hash any technical logs and never store raw IP addresses." },
  { q: "How does AI moderation work?", a: "Every confession, message, comment and chat is scanned in real time. We block content that harms others — harassment, hate, threats — while allowing honest expressions of personal struggle." },
  { q: "Can I delete my content?", a: "Yes. You're always in control and can remove anything you've posted or received." },
  { q: "Is Sera free?", a: "Yes, Sera is free to use. Create your ID, confess, ask and chat at no cost." },
];
