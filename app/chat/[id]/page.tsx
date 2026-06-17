// app/chat/[id]/page.tsx
// A single anonymous conversation with realtime messaging.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getConversation, listMessages } from "@/app/actions/chat";
import { getPresence } from "@/lib/presence";
import Avatar from "@/components/Avatar";
import PresenceDot from "@/components/PresenceDot";
import ChatThread from "@/components/ChatThread";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const convo = await getConversation(id);
  if (!convo) notFound();

  const messages = await listMessages(id);
  const presence = convo.otherUsername
    ? await getPresence(convo.otherUsername)
    : { online: false, lastSeen: null };

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* chat header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/chat"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ←
          </Link>
          <Avatar seed={convo.otherUsername || "sera"} size={36} />
          <div>
            <p className="font-medium">@{convo.otherUsername}</p>
            {convo.otherUsername ? (
              <PresenceDot username={convo.otherUsername} initial={presence} />
            ) : (
              <p className="text-xs text-muted-foreground">Anonymous · end to end private</p>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden">
        <ChatThread conversationId={id} myUserId={me.id} initialMessages={messages} />
      </div>
    </div>
  );
}
