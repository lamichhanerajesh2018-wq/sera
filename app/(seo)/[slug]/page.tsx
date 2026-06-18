// app/(seo)/[slug]/page.tsx
// Programmatic SEO landing pages. One dynamic route renders every entry in
// lib/seo-pages.ts as a statically-generated, indexable page with per-slug
// metadata, FAQ JSON-LD and internal links. Public — no auth wall.
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import InstallButton from "@/components/InstallButton";
import {
  SEO_PAGES,
  getSeoPage,
  getRelatedSeoPages,
} from "@/lib/seo-pages";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://sera.social";

// Build every SEO page at build time (ISR-friendly, fully static).
export function generateStaticParams() {
  return SEO_PAGES.map((p) => ({ slug: p.slug }));
}

// Revalidate occasionally so content edits propagate without a redeploy.
export const revalidate = 86400; // 24h

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page) return {};

  const url = `${SITE_URL}/${page.slug}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: page.title,
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      type: "website",
      url,
      siteName: "Sera",
      title: page.title,
      description: page.metaDescription,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: page.h1,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.metaDescription,
      images: ["/og-image.png"],
    },
    robots: { index: true, follow: true },
  };
}

export default async function SeoLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page) notFound();

  const related = getRelatedSeoPages(page.slug);

  // FAQPage + WebPage structured data for rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/${page.slug}`,
        url: `${SITE_URL}/${page.slug}`,
        name: page.title,
        description: page.metaDescription,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Sera",
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Logo href="/" size="sm" />
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/communities" className="transition-colors hover:text-foreground">
              Communities
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        {/* Hero */}
        <section className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {page.subhead}
          </p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-5xl">
            {page.h1}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {page.intro}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create your anonymous profile
            </Link>
            <InstallButton />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            No real name. No phone number. Free.
          </p>
        </section>

        {/* Content sections */}
        <section className="mx-auto mt-20 max-w-2xl space-y-12">
          {page.sections.map((s) => (
            <div key={s.heading}>
              <h2 className="font-display text-2xl font-medium tracking-tight">
                {s.heading}
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </section>

        {/* Comparison table (alternative pages only) */}
        {page.compare && (
          <section className="mx-auto mt-20 max-w-3xl">
            <h2 className="text-center font-display text-2xl font-medium tracking-tight">
              Sera vs {page.compare.themName}
            </h2>
            <div className="mt-8 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-4 py-3 font-medium"> </th>
                    <th className="px-4 py-3 font-medium text-foreground">Sera</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">
                      {page.compare.themName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.compare.rows.map((r) => (
                    <tr key={r.feature} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-medium">{r.feature}</td>
                      <td className="px-4 py-3 text-foreground">{r.sera}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.them}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-2xl">
          <h2 className="text-center font-display text-2xl font-medium tracking-tight">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-6">
            {page.faqs.map((f) => (
              <div key={f.q} className="border-b border-border/50 pb-6 last:border-0">
                <h3 className="font-medium">{f.q}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto mt-20 max-w-2xl rounded-3xl border border-border bg-muted/30 px-8 py-12 text-center">
          <h2 className="font-display text-2xl font-medium tracking-tight">
            Ready to speak freely?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Create your anonymous profile in seconds and join the conversation.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started — it's free
          </Link>
        </section>

        {/* Internal links */}
        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Explore more
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/${r.slug}`}
                className="rounded-xl border border-border px-5 py-4 transition-colors hover:border-foreground/30 hover:bg-muted/30"
              >
                <span className="font-medium">{r.h1}</span>
                <span className="mt-1 block text-sm text-muted-foreground line-clamp-1">
                  {r.subhead}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-20 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">
            ← Back to Sera
          </Link>
        </footer>
      </main>
    </div>
  );
}
