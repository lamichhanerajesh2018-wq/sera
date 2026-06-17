// app/chat/[id]/page.tsx
// A single anonymous conversation with realtime messaging.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getConversation, listMessages } from "@/app/actions/chat";
import { getPresence } from "@/lib/presence";
import Avatar from "@/components/Avatar";
import PresenceDot from "@/components/PresenceDot";
import MessageRequestActions from "@/components/MessageRequestActions";
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

  const isPending = convo.status === "pending";
  const iAmRequester = convo.requestedBy === me.id;
  const myPendingCount = isPending && iAmRequester
    ? messages.filter((m) => m.senderId === me.id).length
    : 0;
  const requestLimit = 3;

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
        {/* Incoming request: recipient sees accept / decline before the thread. */}
        {convo.isIncomingRequest && (
          <div className="border-b border-border bg-primary/5 px-4 py-3">
            <p className="text-sm font-medium">@{convo.otherUsername} wants to message you</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Accept to start chatting, or decline to remove this. Replying also accepts.
            </p>
            <div className="mt-3">
              <MessageRequestActions conversationId={id} size="md" />
            </div>
          </div>
        )}

        {/* Outgoing request: sender sees a waiting note. */}
        {isPending && iAmRequester && (
          <div className="border-b border-border bg-card/60 px-4 py-2.5 text-center text-xs text-muted-foreground">
            {myPendingCount >= requestLimit
              ? "Message request limit reached. Wait for them to accept before sending more."
              : `This is a message request. You can send ${requestLimit - myPendingCount} more message${
                  requestLimit - myPendingCount === 1 ? "" : "s"
                } until @${convo.otherUsername} accepts.`}
          </div>
        )}

        <ChatThread
          conversationId={id}
          myUserId={me.id}
          initialMessages={messages}
          locked={isPending && iAmRequester && myPendingCount >= requestLimit}
        />
      </div>
    </div>
  );
}
