// app/terms/page.tsx
import LegalShell from "@/components/LegalShell";

export const metadata = {
  title: "Terms of Service — Sera",
  description: "The terms for using Sera.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="June 16, 2026">
      <p>
        Welcome to Sera. By creating an account or using the service, you agree to
        these terms. Please read them — they&apos;re written to keep Sera a safe,
        anonymous space for everyone.
      </p>

      <h2>1. Who can use Sera</h2>
      <p>
        You must be at least 18 years old to use Sera. By using it, you confirm
        that you meet this requirement and that you can form a binding agreement.
      </p>

      <h2>2. Your account</h2>
      <p>
        You&apos;re assigned a random anonymous handle. For pure anonymous accounts,
        a one-time recovery code is the only way back into your account — if you
        lose it, your account cannot be recovered. You&apos;re responsible for
        keeping your password or recovery code safe and for activity on your
        account.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to use Sera to:</p>
      <ul>
        <li>Harass, threaten, bully, or target other people.</li>
        <li>Post hate speech or incite violence or self-harm in others.</li>
        <li>Share content that sexualizes minors or is otherwise illegal.</li>
        <li>Spam, scam, or distribute malware.</li>
        <li>Attempt to de-anonymize, dox, or track other users.</li>
        <li>Evade blocks, bans, rate limits, or moderation.</li>
        <li>Scrape, overload, or interfere with the service.</li>
      </ul>
      <p>
        Sera is meant for honest self-expression, including hard and vulnerable
        things. Expressing your own struggles is welcome. Harming other people is
        not.
      </p>

      <h2>4. Content and moderation</h2>
      <p>
        You own the content you create, but you grant Sera the license needed to
        store and display it as part of operating the service. We use automated
        AI moderation and human review, and we may remove content or suspend
        accounts that violate these terms. Reported content may be reviewed by our
        moderators.
      </p>

      <h2>5. Anonymous messages</h2>
      <p>
        Anyone with your link can send you an anonymous message. We rate-limit and
        moderate these to reduce abuse, but you control your own inbox — you can
        delete messages and block senders where their identity is known. Don&apos;t
        use anonymous messaging to harm others.
      </p>

      <h2>6. Termination</h2>
      <p>
        You can stop using Sera at any time. We may suspend or terminate accounts
        that break these terms or put others at risk, with or without notice where
        necessary to protect the community.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        Sera is provided &quot;as is&quot; without warranties of any kind. We work
        hard to keep it safe and available, but we can&apos;t guarantee it will be
        uninterrupted or error-free, and we&apos;re not responsible for content
        posted by users.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Sera and its operators are not
        liable for indirect, incidental, or consequential damages arising from
        your use of the service.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms as Sera grows. We&apos;ll update the date at the
        top, and continued use means you accept the updated terms.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms? Reach us at <a href="mailto:hello@sera.app">hello@sera.app</a>.
      </p>
    </LegalShell>
  );
}
