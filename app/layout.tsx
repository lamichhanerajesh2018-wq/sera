import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

// Body: Inter — clean, highly readable for a content-heavy social feed.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Display: Fraunces — a characterful high-contrast serif. Gives Sera a literary,
// "anonymous letter / confession" feel instead of a generic techy sans.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "900"],
});

export const metadata: Metadata = {
  title: "Sera — Speak freely. Stay unseen.",
  description:
    "An anonymous social network. Share confessions, join communities, and talk freely — without ever revealing who you are.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
