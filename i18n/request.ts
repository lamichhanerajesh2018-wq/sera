// i18n/request.ts
// next-intl server config — detects locale from cookie (set by LanguageSwitcher)
// then falls back to the browser's Accept-Language header.
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

const SUPPORTED = ["en", "ne", "hi"] as const;
type Locale = (typeof SUPPORTED)[number];

function detectLocale(acceptLanguage: string): Locale {
  const candidates = acceptLanguage
    .split(",")
    .map((s) => s.split(";")[0].trim().split("-")[0].toLowerCase());

  for (const lang of candidates) {
    if (SUPPORTED.includes(lang as Locale)) return lang as Locale;
  }
  return "en";
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headersList = await headers();

  // Cookie takes priority (user manually switched language)
  const fromCookie = cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined;
  const locale: Locale =
    fromCookie && SUPPORTED.includes(fromCookie)
      ? fromCookie
      : detectLocale(headersList.get("accept-language") ?? "en");

  const messages = (await import(`../messages/${locale}.json`)).default;

  return { locale, messages };
});
