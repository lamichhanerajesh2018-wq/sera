import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import BrandMark from "@/components/landing/BrandMark";
import HeroBackground from "@/components/landing/HeroBackground";
import FadeIn from "@/components/landing/FadeIn";
import Manifesto from "@/components/landing/Manifesto";
import ProcessStrip from "@/components/landing/ProcessStrip";
import InterestGraph from "@/components/landing/InterestGraph";
import DiscoverGrid from "@/components/landing/DiscoverGrid";
import Vision from "@/components/landing/Vision";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://sera.social";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "SERA — The Interest & Opportunity Network",
  description:
    "SERA turns what you're interested in into the people, communities, projects, tools and opportunities that come next. Not another feed — a way to discover what actually matters to you.",
  keywords: [
    "interest network",
    "opportunity network",
    "discover communities",
    "discover opportunities",
    "find mentors",
    "next generation social network",
    "SERA",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "SERA",
    title: "SERA — The Interest & Opportunity Network",
    description:
      "Your interests should lead somewhere. SERA turns what you care about into people, communities, tools and opportunities worth your time.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SERA — The Interest & Opportunity Network" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SERA — The Interest & Opportunity Network",
    description:
      "Your interests should lead somewhere. SERA turns what you care about into people, communities, tools and opportunities worth your time.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

const NAV = [
  { href: "#why", label: "Why" },
  { href: "#how", label: "How it works" },
  { href: "#discover", label: "Discover" },
  { href: "#vision", label: "Vision" },
];

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.22em] text-white/40";

const PRIMARY_CTA =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 font-medium text-black transition-transform hover:scale-[1.02]";

const SECONDARY_CTA =
  "inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-7 font-medium text-white/90 backdrop-blur-xl transition-colors hover:border-white/30 hover:bg-white/[0.06]";

export default async function Home() {
  // Signed-in users go straight to the app; the landing page is for visitors.
  const user = await getCurrentUser();
  if (user) redirect("/feed");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "SERA",
        url: SITE_URL,
        description:
          "SERA is an interest and opportunity network that connects what people care about to the people, communities, projects, businesses, software, learning resources, events and jobs around it.",
        logo: `${SITE_URL}/icon-192.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "SERA",
        description: "The interest and opportunity network.",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <div className="dark relative min-h-screen w-full overflow-x-clip bg-[#050509] text-white antialiased selection:bg-violet-500/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---------- NAV ---------- */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050509]/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-white/55 lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="transition-colors hover:text-white">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-white/60 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="rounded-full bg-white px-4 py-2 font-medium text-black transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-24 text-center lg:pt-32">
        <HeroBackground />

        <FadeIn>
          <p className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/60 backdrop-blur">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
            </span>
            The Interest &amp; Opportunity Network
          </p>
        </FadeIn>

        <FadeIn delay={0.06}>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Interest was never supposed
            <br className="hidden sm:block" />{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-200 bg-clip-text text-transparent">
              to end at a feed.
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.12}>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-white/55">
            SERA follows what you&apos;re curious about to the people, projects
            and opportunities it was always meant to lead to.
          </p>
        </FadeIn>

        <FadeIn delay={0.18}>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/onboarding" className={PRIMARY_CTA}>
              Get started
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <a href="#how" className={SECONDARY_CTA}>
              See it work
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={0.24}>
          <p className="mt-5 text-sm text-white/35">Free to join. No feed to escape.</p>
        </FadeIn>
      </section>

      {/* ---------- WHY SERA ---------- */}
      <section id="why" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24 sm:py-28">
        <FadeIn>
          <p className={`${EYEBROW} mb-12 text-center`}>Why SERA</p>
        </FadeIn>
        <Manifesto />
      </section>

      {/* ---------- HOW IT WORKS + INTEREST GRAPH ---------- */}
      <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24 sm:py-28">
        <FadeIn>
          <div className="mb-8 text-center">
            <p className={EYEBROW}>How it works</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              Pick one interest. Watch where it leads.
            </h2>
          </div>
        </FadeIn>

        <div className="mb-14">
          <ProcessStrip />
        </div>

        <FadeIn delay={0.1}>
          <div className="rounded-[32px] border border-white/10 bg-white/[0.02] p-6 sm:p-10">
            <InterestGraph />
          </div>
        </FadeIn>
      </section>

      {/* ---------- EVERYTHING YOU CAN DISCOVER ---------- */}
      <section id="discover" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24 sm:py-28">
        <FadeIn>
          <div className="mb-14 text-center">
            <p className={EYEBROW}>Everything you can discover</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              Content is where it starts. Not where it ends.
            </h2>
          </div>
        </FadeIn>
        <DiscoverGrid />
      </section>

      {/* ---------- VISION ---------- */}
      <section id="vision" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24 sm:py-28">
        <FadeIn>
          <div className="mb-14 text-center">
            <p className={EYEBROW}>What&apos;s next</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight sm:text-4xl">
              We&apos;re building toward something bigger.
            </h2>
          </div>
        </FadeIn>
        <Vision />
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <FadeIn>
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] px-8 py-16 text-center sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/25 via-violet-500/20 to-cyan-400/20 blur-[120px]"
            />
            <div className="relative mx-auto max-w-xl">
              <h2 className="font-display text-3xl font-medium tracking-tight sm:text-5xl">
                Follow your curiosity somewhere real.
              </h2>
              <p className="mx-auto mt-5 max-w-md leading-7 text-white/55">
                Join SERA and see what your interests actually lead to.
              </p>
              <Link href="/onboarding" className={`${PRIMARY_CTA} mt-9`}>
                Get started
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <p className="mt-4 text-xs text-white/30">Free to join. No credit card required.</p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-6 py-14 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <BrandMark />
            <p className="mt-3 max-w-56 text-sm leading-6 text-white/40">
              The interest &amp; opportunity network.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              { label: "Explore", href: "/feed" },
              { label: "Communities", href: "/communities" },
              { label: "Messages", href: "/chat" },
              { label: "Inbox", href: "/inbox" },
            ]}
          />
          <FooterCol
            title="Account"
            links={[
              { label: "Sign up", href: "/onboarding" },
              { label: "Sign in", href: "/login" },
              { label: "Contact", href: "/contact" },
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
        <div className="border-t border-white/[0.06]">
          <p className="mx-auto w-full max-w-6xl px-6 py-6 text-center text-xs text-white/30">
            © 2026 SERA. The interest &amp; opportunity network.
          </p>
        </div>
      </footer>
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
      <p className="text-sm font-medium text-white/80">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-white/40">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
