// app/guidelines/page.tsx
import LegalShell from "@/components/LegalShell";

export const metadata = {
  title: "Community Guidelines — Sera",
  description: "What's welcome on Sera, and what isn't.",
};

export default function GuidelinesPage() {
  return (
    <LegalShell title="Community Guidelines" updated="June 16, 2026">
      <p>
        Sera exists so people can say the things they can&apos;t say anywhere else
        — honestly, anonymously, without judgment. These guidelines keep it that
        way. The core idea is simple: <strong>be honest about your own life, and
        never use that freedom to harm someone else.</strong>
      </p>

      <h2>What Sera is for</h2>
      <ul>
        <li>Confessions and thoughts you can&apos;t share publicly.</li>
        <li>Honest expressions of how you&apos;re really doing — including the hard parts.</li>
        <li>Asking and answering anonymous questions.</li>
        <li>Finding communities of people who understand you.</li>
      </ul>
      <p>
        Vulnerability is welcome here. Talking about your own pain, doubt, fear or
        struggle will never get you in trouble. That&apos;s the whole point of Sera.
      </p>

      <h2>What&apos;s not allowed</h2>
      <p>The line is harm to other people. Don&apos;t:</p>
      <ul>
        <li><strong>Harass or bully</strong> anyone, or target a person with cruelty.</li>
        <li><strong>Threaten violence</strong> or encourage others to hurt themselves or someone else.</li>
        <li><strong>Post hate speech</strong> against people based on who they are.</li>
        <li><strong>Sexualize minors</strong> in any way. This results in an immediate ban and may be reported.</li>
        <li><strong>Dox or de-anonymize</strong> people — no sharing private info or trying to identify who&apos;s behind a handle.</li>
        <li><strong>Spam or scam</strong> — no flooding, advertising, phishing, or malware.</li>
        <li><strong>Abuse anonymous messaging</strong> to send cruelty you wouldn&apos;t own with your name.</li>
      </ul>

      <h2>How moderation works</h2>
      <p>
        Every confession, message, comment and chat is scanned in real time by an
        AI moderation system. It&apos;s tuned to block content that harms others
        while letting honest expressions of personal struggle through. On top of
        that, you can report anything that crosses the line, and our moderators
        review reports and take action — from removing content to banning accounts.
      </p>

      <h2>Tools you control</h2>
      <ul>
        <li><strong>Block</strong> people so they can&apos;t message, ask, or chat with you.</li>
        <li><strong>Delete</strong> any message or content you&apos;ve received or posted.</li>
        <li><strong>Report</strong> content that breaks these guidelines.</li>
        <li>Keep your answers <strong>private</strong>, or share them publicly — your choice.</li>
      </ul>

      <h2>A note on hard moments</h2>
      <p>
        If you&apos;re going through something heavy, you&apos;re not alone, and
        you&apos;re allowed to say it here. Sera is a place to be heard. If you ever
        feel in danger or in crisis, please also reach out to someone you trust or
        a local support service — Sera is a space to think, not a substitute for
        real-world help.
      </p>

      <h2>Consequences</h2>
      <p>
        Breaking these guidelines can lead to content removal, rate limits, or a
        permanent ban, depending on severity. Content that endangers children is
        always removed and may be reported to the relevant authorities.
      </p>

      <h2>Questions</h2>
      <p>
        Not sure if something&apos;s okay? Reach out at <a href="mailto:hello@sera.app">hello@sera.app</a>.
        Thanks for helping keep Sera a safe place to speak freely.
      </p>
    </LegalShell>
  );
}
