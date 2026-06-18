// lib/seo-pages.ts
// Single source of truth for programmatic SEO landing pages.
// Each entry renders at /[slug] via app/(seo)/[slug]/page.tsx and is
// added to the sitemap automatically. To add a new page, append an object.

export type SeoSection = { heading: string; body: string };
export type SeoFaq = { q: string; a: string };
export type SeoCompareRow = { feature: string; sera: string; them: string };

export type SeoPage = {
  slug: string;
  // <title> + OG title
  title: string;
  metaDescription: string;
  keywords: string[];
  // on-page hero
  h1: string;
  subhead: string;
  intro: string; // 1-2 paragraph lead under the hero
  sections: SeoSection[];
  // optional comparison table (used by "X-alternative" pages)
  compare?: { themName: string; rows: SeoCompareRow[] };
  faqs: SeoFaq[];
};

export const SEO_PAGES: SeoPage[] = [
  // ───────────────────────── BEST / GENERIC ─────────────────────────
  {
    slug: "best-anonymous-social-network",
    title: "The Best Anonymous Social Network in 2026 — Sera",
    metaDescription:
      "Sera is the best anonymous social network to post confessions, get anonymous messages, join communities and chat — no real name, no phone number, AI moderated.",
    keywords: [
      "best anonymous social network",
      "anonymous social network",
      "anonymous app",
      "post anonymously",
    ],
    h1: "The Best Anonymous Social Network",
    subhead: "Speak freely. Stay unseen.",
    intro:
      "Sera is an anonymous social network built for honest conversation. Share confessions, receive anonymous messages, join communities and chat one-on-one — all without ever revealing who you are. No real names. No phone numbers. Every post is AI moderated to keep the space safe.",
    sections: [
      {
        heading: "Truly anonymous by design",
        body: "You get an auto-generated handle and a geometric avatar the moment you join. There's no real name, no profile photo and no phone number to leak. Your identity stays yours, and your IP is never stored in raw form — it's hashed with a salt purely for safety.",
      },
      {
        heading: "Everything in one place",
        body: "Most anonymous apps do one thing. Sera combines a public confessions feed, anonymous Q&A links, private one-on-one chat, communities and notifications into a single product — so you don't need five different apps to speak freely.",
      },
      {
        heading: "AI moderation that keeps it safe",
        body: "Anonymity shouldn't mean chaos. Every post and message passes through automated moderation before it spreads, so harassment and harmful content get caught early while genuine conversation stays free.",
      },
    ],
    faqs: [
      {
        q: "Is Sera really anonymous?",
        a: "Yes. You sign up without a real name, phone number or email, and you're given a random handle and avatar. We never store raw IP addresses.",
      },
      {
        q: "Is Sera free?",
        a: "Yes, Sera is free to use. Create a profile and start posting in seconds.",
      },
      {
        q: "What can I do on Sera?",
        a: "Post anonymous confessions, share an ask-link to collect anonymous questions, chat privately, and join topic communities.",
      },
    ],
  },
  {
    slug: "anonymous-discussion-platform",
    title: "Anonymous Discussion Platform — Talk Freely on Sera",
    metaDescription:
      "Sera is an anonymous discussion platform for open, honest conversation. Join communities, post threads and reply — without revealing your identity. AI moderated.",
    keywords: [
      "anonymous discussion platform",
      "anonymous forum",
      "anonymous discussion board",
      "discuss anonymously",
    ],
    h1: "An Anonymous Discussion Platform",
    subhead: "Real conversations, zero exposure.",
    intro:
      "Sera gives you a place to discuss anything openly without your name attached. Start threads, reply, and join communities organized around the topics you care about — knowing your identity is never on display.",
    sections: [
      {
        heading: "Communities for every topic",
        body: "Discussion happens inside communities you can join freely. Whether it's mental health, campus life, relationships or niche hobbies, there's a space to talk — and you can start your own.",
      },
      {
        heading: "Honesty without consequences",
        body: "When your name isn't attached, people say what they actually think. Sera is built for the conversations that are too honest, too vulnerable or too awkward to have under your real identity.",
      },
      {
        heading: "Moderated, not lawless",
        body: "Open discussion only works when people feel safe. AI moderation runs on every post, so the platform stays welcoming instead of devolving into noise.",
      },
    ],
    faqs: [
      {
        q: "Do I need an account to read discussions?",
        a: "You can browse public discussions as a guest. To post or reply, create a free anonymous profile.",
      },
      {
        q: "Can I start my own discussion community?",
        a: "Yes. Any signed-in member can create a community around a topic and invite others to join the conversation.",
      },
    ],
  },
  {
    slug: "anonymous-community-app",
    title: "Anonymous Community App — Find Your People on Sera",
    metaDescription:
      "Sera is an anonymous community app where you join groups, share confessions and chat — no real name required. Build real connection while staying unseen.",
    keywords: [
      "anonymous community app",
      "anonymous groups",
      "anonymous community",
      "join anonymous community",
    ],
    h1: "An Anonymous Community App",
    subhead: "Belong without being known.",
    intro:
      "Sera lets you find and join communities of people who get it — without ever exposing your identity. Share what's on your mind, support others, and build genuine connection from behind an anonymous handle.",
    sections: [
      {
        heading: "Join communities that fit",
        body: "Browse and join communities built around shared interests, struggles and experiences. Each one is its own space with its own feed of posts and replies.",
      },
      {
        heading: "Connection without exposure",
        body: "You can be open about the things you'd never post under your real name, and still build a presence people recognize through your handle and avatar — anonymity and identity at the same time.",
      },
      {
        heading: "Take it private",
        body: "Found someone you click with in a community? Start a private one-on-one chat with a message request, so deeper conversations stay between the two of you.",
      },
    ],
    faqs: [
      {
        q: "How do I join a community?",
        a: "Browse communities, open one that interests you, and tap join. You'll start seeing its posts in your feed.",
      },
      {
        q: "Can I message people from a community privately?",
        a: "Yes. You can send a message request, and once accepted you can chat one-on-one in real time.",
      },
    ],
  },
  {
    slug: "anonymous-chat-platform",
    title: "Anonymous Chat Platform — Real-Time Private Chat on Sera",
    metaDescription:
      "Sera is an anonymous chat platform for real-time, private one-on-one conversations. No real name, no phone number. Message requests keep your inbox yours.",
    keywords: [
      "anonymous chat platform",
      "anonymous chat",
      "chat anonymously",
      "anonymous messaging app",
    ],
    h1: "An Anonymous Chat Platform",
    subhead: "Private conversations, no identity attached.",
    intro:
      "Sera lets you chat one-on-one in real time without revealing who you are. A message-request system means no one can flood your inbox — you decide who you talk to, all from behind an anonymous handle.",
    sections: [
      {
        heading: "Real-time, one-on-one",
        body: "Messages arrive instantly. Conversations feel live and natural — just without your real name, number or photo anywhere in the picture.",
      },
      {
        heading: "You control who reaches you",
        body: "New conversations come in as requests. Accept the ones you want and ignore the rest, so your inbox stays yours instead of an open door.",
      },
      {
        heading: "Presence, on your terms",
        body: "See when the person you're talking to is around with online and last-seen indicators — without exposing anything about your real identity.",
      },
    ],
    faqs: [
      {
        q: "Is the chat really real-time?",
        a: "Yes. Messages are delivered instantly so conversations feel live.",
      },
      {
        q: "Can anyone message me?",
        a: "New conversations arrive as message requests. You choose which to accept, so you stay in control of your inbox.",
      },
    ],
  },
  // ───────────────────────── AUDIENCE ─────────────────────────
  {
    slug: "anonymous-social-network-for-students",
    title: "Anonymous Social Network for Students — Sera",
    metaDescription:
      "Sera is an anonymous social network for students. Vent about classes, ask anything, join your campus community and chat — without your name attached. AI moderated.",
    keywords: [
      "anonymous social network for students",
      "anonymous app for students",
      "student confessions",
      "anonymous student community",
    ],
    h1: "An Anonymous Social Network for Students",
    subhead: "Say what you can't say with your name on it.",
    intro:
      "School and student life come with a lot you can't post under your real name. Sera gives students an anonymous space to vent about classes, ask honest questions, share confessions and find people going through the same thing — all without exposing who you are.",
    sections: [
      {
        heading: "Vent without it following you",
        body: "Stress, drama, burnout, the things you'd never put on your real socials — post it anonymously and let it out without it ever being tied back to you.",
      },
      {
        heading: "Ask anything, honestly",
        body: "Share your ask-link and let classmates send you anonymous questions, or post your own. The honesty you only get when names are off the table.",
      },
      {
        heading: "Find your people",
        body: "Join communities of students dealing with the same classes, the same pressures and the same questions — and chat privately when you find someone who gets it.",
      },
    ],
    faqs: [
      {
        q: "Will anyone know it's me?",
        a: "No. You post under a random handle with no real name, phone number or email, so your posts aren't tied back to you.",
      },
      {
        q: "Is it safe for students?",
        a: "Every post and message is AI moderated, and we never store raw IP addresses — only a salted hash for safety.",
      },
    ],
  },
  {
    slug: "anonymous-social-network-for-teens",
    title: "Anonymous Social Network for Teens — Sera",
    metaDescription:
      "Sera is an anonymous social network where teens can share confessions, get anonymous messages and join communities safely. No real name, no phone number, AI moderated.",
    keywords: [
      "anonymous social network for teens",
      "anonymous app for teens",
      "teen confessions",
      "anonymous teen community",
    ],
    h1: "An Anonymous Social Network for Teens",
    subhead: "A space to be honest, without being exposed.",
    intro:
      "Sera gives teens a safe, anonymous place to share what's really on their mind — confessions, questions, feelings — without their name, photo or number attached. AI moderation runs on everything to keep the space healthy.",
    sections: [
      {
        heading: "Honesty without the pressure",
        body: "No followers to perform for and no real name on display. Just a place to say the things that are hard to say out loud.",
      },
      {
        heading: "Anonymous questions",
        body: "Share an ask-link so friends can send you anonymous questions, or collect honest thoughts about anything you're curious about.",
      },
      {
        heading: "Safety built in",
        body: "Every post passes AI moderation, raw IPs are never stored, and a message-request system means strangers can't flood your inbox.",
      },
    ],
    faqs: [
      {
        q: "Do I need to give my real name or number?",
        a: "No. Sera doesn't require a real name, phone number or email. You get a random handle when you join.",
      },
      {
        q: "How does Sera stay safe?",
        a: "Posts and messages are AI moderated, raw IP addresses are never stored, and you control who can message you through message requests.",
      },
    ],
  },
  {
    slug: "anonymous-social-network-for-college-students",
    title: "Anonymous Social Network for College Students — Sera",
    metaDescription:
      "Sera is an anonymous social network for college students. Post confessions, join your campus community, ask anything and chat — without revealing your identity.",
    keywords: [
      "anonymous social network for college students",
      "anonymous college app",
      "college confessions",
      "campus anonymous community",
    ],
    h1: "An Anonymous Social Network for College Students",
    subhead: "Campus life, off the record.",
    intro:
      "College is messy, intense and impossible to fully post about under your real name. Sera gives college students an anonymous space to share confessions, talk about campus life, ask honest questions and connect — without anyone knowing it's you.",
    sections: [
      {
        heading: "The campus confessions you can't post elsewhere",
        body: "Relationships, professors, roommates, late-night thoughts — say it anonymously instead of bottling it up or risking it on your real account.",
      },
      {
        heading: "Communities for campus life",
        body: "Join communities around majors, dorm life, exams and everything in between, and find students going through exactly what you are.",
      },
      {
        heading: "Private chat when you click",
        body: "When a conversation goes somewhere real, take it private with one-on-one chat — still fully anonymous, still on your terms.",
      },
    ],
    faqs: [
      {
        q: "Is it tied to my college email?",
        a: "No. Sera doesn't require any email, real name or phone number. You stay fully anonymous.",
      },
      {
        q: "Can I find people from my own campus?",
        a: "You can join and create communities around campus topics to connect with students sharing the same experience.",
      },
    ],
  },
  // ───────────────────────── ALTERNATIVES ─────────────────────────
  {
    slug: "reddit-alternative",
    title: "A Reddit Alternative That's Actually Anonymous — Sera",
    metaDescription:
      "Looking for a Reddit alternative? Sera is an anonymous community app with confessions, communities and private chat — no karma, no real identity, AI moderated.",
    keywords: [
      "reddit alternative",
      "anonymous reddit alternative",
      "apps like reddit",
      "reddit alternative anonymous",
    ],
    h1: "A Reddit Alternative Built for Anonymity",
    subhead: "Communities and confessions, without the baggage.",
    intro:
      "If you love community-driven discussion but want true anonymity and a calmer space, Sera is a Reddit alternative worth trying. Join communities, post confessions and chat privately — without karma games or your identity following you around.",
    sections: [
      {
        heading: "Communities without the performance",
        body: "Sera keeps the best part of Reddit — topic communities — but drops the karma chase. You post to connect, not to farm points.",
      },
      {
        heading: "Anonymous by default, not by exception",
        body: "On Sera there's no persistent reputation to protect and no real identity to slip out. Everyone is anonymous from the start.",
      },
      {
        heading: "Private chat built in",
        body: "Instead of clunky DMs, Sera has real-time one-on-one chat with a message-request system, so conversations stay wanted.",
      },
    ],
    compare: {
      themName: "Reddit",
      rows: [
        { feature: "Anonymous by default", sera: "Yes — random handle, no real name", them: "Pseudonymous, accounts persist" },
        { feature: "Karma / points", sera: "None", them: "Core mechanic" },
        { feature: "Confessions feed", sera: "Built in", them: "Subreddit-dependent" },
        { feature: "Real-time private chat", sera: "Yes, with message requests", them: "Basic DMs" },
        { feature: "AI moderation on every post", sera: "Yes", them: "Volunteer mod-dependent" },
      ],
    },
    faqs: [
      {
        q: "Is Sera like Reddit?",
        a: "Sera shares Reddit's community model but is fully anonymous by default, has no karma system, and includes a built-in confessions feed and real-time chat.",
      },
      {
        q: "Is Sera anonymous like Reddit?",
        a: "More so. Sera gives you a random handle with no real name, email or phone number, and never stores raw IP addresses.",
      },
    ],
  },
  {
    slug: "quora-alternative",
    title: "A Quora Alternative for Anonymous Questions — Sera",
    metaDescription:
      "Want a Quora alternative? Sera lets you ask and answer anonymously with ask-links, communities and private chat — no real name, no profile to maintain.",
    keywords: [
      "quora alternative",
      "anonymous quora alternative",
      "anonymous q&a app",
      "ask questions anonymously",
    ],
    h1: "A Quora Alternative for Honest, Anonymous Answers",
    subhead: "Ask anything. Answer freely.",
    intro:
      "Sera is a Quora alternative for people who want honest answers without a public profile attached. Share an ask-link to collect anonymous questions, answer from a private inbox, and discuss in communities — all without revealing who you are.",
    sections: [
      {
        heading: "Ask-links instead of public profiles",
        body: "Share your personal ask-link anywhere and let people send you anonymous questions. Answer the ones you want from your private inbox.",
      },
      {
        heading: "Answers without reputation pressure",
        body: "No public credentials, no follower count, no profile to maintain. People answer honestly because there's nothing to protect.",
      },
      {
        heading: "Discussion in communities",
        body: "Beyond Q&A, join communities to discuss topics in depth and take conversations into private chat when you want.",
      },
    ],
    compare: {
      themName: "Quora",
      rows: [
        { feature: "Anonymous by default", sera: "Yes", them: "Real-name encouraged" },
        { feature: "Anonymous ask-links", sera: "Built in", them: "Limited" },
        { feature: "Private answer inbox", sera: "Yes", them: "No" },
        { feature: "Real-time chat", sera: "Yes", them: "No" },
        { feature: "AI moderation", sera: "Every post", them: "Mixed" },
      ],
    },
    faqs: [
      {
        q: "Can I ask questions anonymously on Sera?",
        a: "Yes. Share your ask-link and anyone can send you anonymous questions, which you answer privately from your inbox.",
      },
      {
        q: "How is Sera different from Quora?",
        a: "Sera is anonymous by default with no public profile or credentials, uses ask-links and a private inbox, and adds communities and real-time chat.",
      },
    ],
  },
  {
    slug: "whisper-alternative",
    title: "A Whisper Alternative for Anonymous Confessions — Sera",
    metaDescription:
      "Looking for a Whisper alternative? Sera is an anonymous confessions app with communities, anonymous messages and real-time chat — AI moderated and privacy-first.",
    keywords: [
      "whisper alternative",
      "apps like whisper",
      "anonymous confessions app",
      "whisper app alternative",
    ],
    h1: "A Whisper Alternative for Anonymous Confessions",
    subhead: "Let it out. Stay unseen.",
    intro:
      "If you're looking for a Whisper alternative, Sera is an anonymous confessions app that goes further. Post confessions, receive anonymous messages, join communities and chat one-on-one — all behind an anonymous handle, with AI moderation on everything.",
    sections: [
      {
        heading: "Confessions at the core",
        body: "Sera is built around the honest, anonymous posting that made confession apps popular — share what's really on your mind without your identity attached.",
      },
      {
        heading: "More than a wall of posts",
        body: "Beyond confessions, you get anonymous ask-links, communities and private chat, so a single post can turn into a real conversation.",
      },
      {
        heading: "Privacy-first and moderated",
        body: "Raw IP addresses are never stored, and AI moderation runs on every post to keep the space safe rather than toxic.",
      },
    ],
    compare: {
      themName: "Whisper",
      rows: [
        { feature: "Anonymous confessions", sera: "Yes", them: "Yes" },
        { feature: "Communities", sera: "Built in", them: "Limited" },
        { feature: "Anonymous ask-links", sera: "Yes", them: "No" },
        { feature: "Real-time private chat", sera: "Yes, with requests", them: "Basic" },
        { feature: "No raw IP stored", sera: "Yes — salted hash only", them: "Unclear" },
      ],
    },
    faqs: [
      {
        q: "Is Sera like Whisper?",
        a: "Sera shares Whisper's anonymous confessions focus but adds communities, anonymous ask-links and real-time private chat, with AI moderation on every post.",
      },
      {
        q: "How private is Sera?",
        a: "Sera requires no real name, phone or email, and never stores raw IP addresses — only a salted hash used for safety.",
      },
    ],
  },
  {
    slug: "yik-yak-alternative",
    title: "A Yik Yak Alternative for Anonymous Posting — Sera",
    metaDescription:
      "Want a Yik Yak alternative? Sera is an anonymous social network with confessions, communities and private chat — no real name, AI moderated, privacy-first.",
    keywords: [
      "yik yak alternative",
      "apps like yik yak",
      "anonymous posting app",
      "yik yak alternative anonymous",
    ],
    h1: "A Yik Yak Alternative That Goes Further",
    subhead: "Anonymous posting, done right.",
    intro:
      "If you miss the anonymous, in-the-moment posting of Yik Yak, Sera is an alternative worth trying. Post anonymously, join communities, collect anonymous messages and chat privately — all without revealing who you are, and with AI moderation keeping it safe.",
    sections: [
      {
        heading: "Anonymous posting, no name attached",
        body: "Share what's on your mind to a public feed under a random handle. The spontaneous honesty of anonymous posting, without your identity on the line.",
      },
      {
        heading: "Communities beyond your location",
        body: "Instead of being limited to who's physically nearby, join communities built around topics and interests, so you always have somewhere to post.",
      },
      {
        heading: "Safer by design",
        body: "Anonymous apps live or die on moderation. Sera runs AI moderation on every post and never stores raw IPs, keeping the space healthier than the apps that came before it.",
      },
    ],
    compare: {
      themName: "Yik Yak",
      rows: [
        { feature: "Anonymous posting", sera: "Yes", them: "Yes" },
        { feature: "Topic communities", sera: "Yes", them: "Location-based only" },
        { feature: "Anonymous ask-links", sera: "Yes", them: "No" },
        { feature: "Real-time private chat", sera: "Yes", them: "No" },
        { feature: "AI moderation on every post", sera: "Yes", them: "Limited" },
      ],
    },
    faqs: [
      {
        q: "Is Sera like Yik Yak?",
        a: "Sera offers the same anonymous posting feel but adds topic communities, anonymous ask-links and real-time private chat, with AI moderation on every post.",
      },
      {
        q: "Is Sera location-based like Yik Yak?",
        a: "No. Instead of limiting you to nearby users, Sera organizes conversation into topic communities you can join from anywhere.",
      },
    ],
  },
];

export const SEO_SLUGS = SEO_PAGES.map((p) => p.slug);

export function getSeoPage(slug: string): SeoPage | undefined {
  return SEO_PAGES.find((p) => p.slug === slug);
}

// Pick a few related pages (excluding the current one) for internal linking.
export function getRelatedSeoPages(slug: string, count = 4): SeoPage[] {
  return SEO_PAGES.filter((p) => p.slug !== slug).slice(0, count);
}
