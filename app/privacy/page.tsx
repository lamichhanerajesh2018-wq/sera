// app/privacy/page.tsx
import LegalShell from "@/components/LegalShell";

export const metadata = {
  title: "Privacy Policy — Sera",
  description: "How Sera handles your data. Anonymous by design.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 16, 2026">
      <p>
        Sera is built to be anonymous by design. This policy explains what we
        collect, why, and the steps we take to make sure nothing you share is
        tied to your real identity. In plain terms: other users never see who you
        are, and we keep the absolute minimum needed to keep the platform safe.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>You are identified only by a random handle like <strong>sera-1234</strong>. You never have to give a real name.</li>
        <li>We never store your raw IP address. We store a one-way cryptographic hash of it, used only to prevent abuse.</li>
        <li>Email is optional, used only for account recovery, and never shown to anyone.</li>
        <li>We don&apos;t sell your data and we don&apos;t run ads.</li>
      </ul>

      <h2>What we collect</h2>

      <h3>Your handle</h3>
      <p>
        When you sign up, you&apos;re assigned a random anonymous handle. This is
        the only identity other people on Sera ever see. You can&apos;t choose it,
        which keeps handles uniform and hard to link to a real person.
      </p>

      <h3>Email (optional)</h3>
      <p>
        If you choose a <strong>recoverable account</strong>, you provide an email
        address used solely to verify your account and let you recover access if
        you lose your password. Your email is private and is never displayed to
        other users. If you choose a <strong>pure anonymous account</strong>, no
        email is collected at all — you receive a one-time recovery code instead.
      </p>

      <h3>Content you create</h3>
      <p>
        Confessions, messages, questions, answers, comments, communities and chats
        are stored so the product works. Anonymous messages sent to you are stored
        without revealing who sent them.
      </p>

      <h3>Minimal safety logs</h3>
      <p>
        To keep Sera safe from spam and abuse, we keep a minimal security log tied
        to certain actions (such as sign-up and posting). This log includes:
      </p>
      <ul>
        <li>A <strong>SHA-256 hash</strong> of your IP address combined with a secret salt — never the raw IP itself.</li>
        <li>A coarse user-agent string and, at most, a country (never your city or precise location).</li>
        <li>The type of action and a timestamp.</li>
      </ul>
      <p>
        Because the IP is hashed with a secret, we cannot read it back as a plain
        address. The hash lets us detect patterns (for example, a single source
        spamming accounts) without keeping data that directly identifies you.
      </p>

      <h2>How we use what we collect</h2>
      <ul>
        <li>To run core features — posting, messaging, communities and chat.</li>
        <li>To moderate content with AI and human review, keeping the space safe.</li>
        <li>To prevent and respond to abuse, spam and rate-limit violations.</li>
        <li>To let you recover a recoverable account via email.</li>
      </ul>

      <h2>AI moderation</h2>
      <p>
        Content you post is scanned in real time by an automated moderation
        system. It is designed to block content that harms others — harassment,
        hate, threats — while deliberately allowing honest expressions of personal
        struggle, which are core to what Sera is for. Moderation happens on the
        text of your content only.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell or rent your data.</li>
        <li>We do not show ads or let advertisers target you.</li>
        <li>We do not store raw IP addresses.</li>
        <li>We do not reveal the sender of an anonymous message to its recipient.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We share data only with the service providers needed to operate Sera (such
        as our database host, real-time messaging provider, and email provider),
        and only as needed to deliver the service. We may disclose information if
        required by a valid legal process — but because we minimize and hash what
        we hold, there is little that directly identifies you.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can delete content you&apos;ve posted or received at any time.</li>
        <li>You can block other users from contacting you.</li>
        <li>You can stop using Sera at any time.</li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We keep content for as long as your account is active or as needed to
        provide the service. Safety logs are kept only as long as useful for abuse
        prevention and are intended to be pruned over time.
      </p>

      <h2>Children</h2>
      <p>
        Sera is not intended for anyone under the age of 18. We do not knowingly
        collect information from minors. If you believe a minor is using Sera,
        please contact us.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy as Sera evolves. We&apos;ll update the date at the
        top when we do.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? Reach us at <a href="mailto:hello@sera.app">hello@sera.app</a>.
      </p>
    </LegalShell>
  );
}
