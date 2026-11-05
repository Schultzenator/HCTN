import { useEffect, useState } from "react";
import { agentChat } from "@agent-native/core";
import { useActionQuery, useActionMutation } from "@agent-native/core/client/hooks";

 type TriageItem = {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  status: "pending" | "reviewed" | "sent" | "rejected";
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  suggestedAction?: string;
  draftReply?: string;
  humanNote?: string;
};

type Stats = {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
};

const FILTERS: Array<{ key: "pending" | "reviewed" | "sent" | "rejected" | "all"; label: string }> = [
  { key: "pending", label: "Waiting for agent" },
  { key: "reviewed", label: "Needs review" },
  { key: "sent", label: "Sent" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  reviewed: "bg-blue-100 text-blue-800",
  sent: "bg-emerald-100 text-emerald-800",
  rejected: "bg-zinc-200 text-zinc-600",
};

const priorityStyles: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-600",
  normal: "bg-sky-100 text-sky-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

function Chip({ label, className }: { label: string; className?: string | undefined }) {
  return (
    <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + (className ?? "bg-zinc-100 text-zinc-700")}>
      {label}
    </span>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins + " min ago";
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + " h ago";
  return Math.round(hours / 24) + " d ago";
}

function TriageCard({ item }: { item: TriageItem }) {
  const [draft, setDraft] = useState(item.draftReply ?? "");
  const approve = useActionMutation("approve-item");
  const reject = useActionMutation("reject-item");
  const updateDraft = useActionMutation("update-draft");

  useEffect(() => {
    setDraft(item.draftReply ?? "");
  }, [item.id, item.draftReply]);

  const editable = item.status === "reviewed";

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <Chip label={item.status} className={statusStyles[item.status]} />
        {item.category ? <Chip label={item.category} /> : null}
        {item.priority ? <Chip label={item.priority} className={priorityStyles[item.priority]} /> : null}
        <span className="ml-auto text-xs text-muted-foreground">{timeAgo(item.receivedAt)}</span>
      </header>
      <h3 className="mt-2 font-semibold">{item.subject}</h3>
      <p className="text-xs text-muted-foreground">{item.from}</p>
      <p className="mt-2 whitespace-pre-line text-sm">{item.body}</p>
      {item.suggestedAction ? (
        <p className="mt-3 rounded-lg bg-muted p-2 text-xs">Next step: {item.suggestedAction}</p>
      ) : null}
      {item.status === "sent" ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="text-xs font-medium text-emerald-700">Sent reply</p>
          <p className="mt-1 whitespace-pre-line">{item.draftReply}</p>
        </div>
      ) : null}
      {item.status === "rejected" ? (
        <p className="mt-3 text-xs text-muted-foreground">Rejected{item.humanNote ? ": " + item.humanNote : ""}</p>
      ) : null}
      {item.status === "pending" ? (
        <p className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Not triaged yet. Ask the agent to triage the queue, or triage it yourself in chat.
        </p>
      ) : null}
      {editable ? (
        <div className="mt-3">
          <label className="text-xs font-medium text-muted-foreground">Draft reply (edit before sending)</label>
          <textarea
            className="mt-1 min-h-28 w-full rounded-lg border bg-background p-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== (item.draftReply ?? "")) updateDraft.mutate({ itemId: item.id, draftReply: draft });
            }}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={approve.isPending || draft.trim().length === 0}
              onClick={() => approve.mutate({ itemId: item.id, finalReply: draft })}
            >
              Approve & send
            </button>
            <button
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={reject.isPending}
              onClick={() => reject.mutate({ itemId: item.id })}
            >
              Reject
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function DeskRoute() {
  const [filter, setFilter] = useState<"pending" | "reviewed" | "sent" | "rejected" | "all">("pending");
  const { data: stats } = useActionQuery<Stats>("queue-stats", {}, { refetchInterval: 2500 });
  const { data: list, isLoading } = useActionQuery<{ items: TriageItem[] }>(
    "list-items",
    filter === "all" ? {} : { status: filter },
    { refetchInterval: 2500 },
  );
  const addMail = useActionMutation("add-incoming-items");

  const items = list?.items ?? [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Triage Desk</h1>
          <p className="text-sm text-muted-foreground">
            The agent drafts. You approve. Every step shares the same actions.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={addMail.isPending}
            onClick={() => addMail.mutate({ count: 3 })}
          >
            Simulate incoming mail
          </button>
          <button
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            onClick={() =>
              agentChat.submit(
                "Triage the inbox: call list-items for pending items, then for each one call record-triage with a fitting category, priority, suggestedAction and a short warm draftReply in the language of the message. Finish with a one-paragraph queue summary.",
              )
            }
          >
            Triage queue with agent
          </button>
        </div>
      </header>

      <section className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === "all" ? stats?.total ?? 0 : stats?.byStatus?.[f.key] ?? 0;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              className={
                "rounded-full px-3 py-1 text-sm " +
                (active ? "bg-primary text-primary-foreground" : "border text-muted-foreground")
              }
              onClick={() => setFilter(f.key)}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </section>

      <section className="grid gap-4">
        {isLoading ? <p className="text-muted-foreground">Loading queue...</p> : null}
        {!isLoading && items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing here. Simulate incoming mail, then let the agent triage.
          </p>
        ) : null}
        {items.map((item) => (
          <TriageCard key={item.id} item={item} />
        ))}
      </section>
    </main>
  );
}
