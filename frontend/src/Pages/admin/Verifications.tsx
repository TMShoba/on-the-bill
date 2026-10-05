import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import axios from "axios";
import NavBar from "../../components/NavBar";
import VerificationBadge from "../../components/VerificationBadge";
import { useAuth } from "../../context/AuthContext";
import {
  decideVerification,
  fetchReviewFile,
  fetchReviewQueue,
  type ReviewDecision,
  type ReviewItem,
} from "../../Services/verificationStore";

type Tab = "pending_review" | "fully_verified" | "identity_verified" | "rejected";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending_review", label: "To review" },
  { key: "fully_verified", label: "Verified" },
  { key: "identity_verified", label: "Identity only" },
  { key: "rejected", label: "Rejected" },
];

function fmt(value?: string) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function age(dob?: string) {
  if (!dob) return null;
  return Math.floor((Date.now() - Date.parse(dob)) / (365.2425 * 24 * 3600 * 1000));
}

/** Loads a private document as an object URL (revoked on change/unmount) */
function DocumentPreview({ userId, kind, label }: { userId: string; kind: "id" | "selfie"; label: string }) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setFile(null);
    setError("");
    fetchReviewFile(userId, kind)
      .then((f) => {
        url = f.url;
        if (cancelled) URL.revokeObjectURL(f.url);
        else setFile(f);
      })
      .catch(() => !cancelled && setError("Couldn't load this file."));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [userId, kind]);

  return (
    <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <figcaption className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
        {label}
        {file && (
          <a href={file.url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
            Open full size ↗
          </a>
        )}
      </figcaption>
      <div className="flex aspect-[4/3] items-center justify-center">
        {error ? (
          <p className="text-xs text-rose-600">{error}</p>
        ) : !file ? (
          <div className="skeleton h-full w-full" />
        ) : file.type === "application/pdf" ? (
          <iframe title={label} src={file.url} className="h-full w-full bg-white" />
        ) : (
          <img src={file.url} alt={label} className="h-full w-full object-contain" />
        )}
      </div>
    </figure>
  );
}

function ReviewPanel({ item, onDone }: { item: ReviewItem; onDone: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");
  const decide = useMutation({
    mutationFn: ({ decision, reason }: { decision: ReviewDecision; reason?: string }) =>
      decideVerification(item.userId, decision, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      onDone();
    },
    onError: (e) => setError((axios.isAxiosError(e) && e.response?.data?.message) || "Could not save the decision."),
  });
  const years = age(item.dateOfBirth);
  const pending = item.status === "pending_review";

  return (
    <motion.div
      key={item.userId}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">{item.legalName || item.accountName}</h2>
          <p className="text-sm text-slate-500">
            {item.stageName ? `${item.stageName} · ` : ""}
            {item.accountEmail}
          </p>
        </div>
        <VerificationBadge status={item.status} size="md" />
      </div>

      {item.reviewNotes && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">⚠ {item.reviewNotes}</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {[
          ["Claim", item.claimType === "manager" ? "Manager" : "Artist (self)"],
          ["ID number", `•••• ${item.idNumberLast4}`],
          ["Date of birth", item.dateOfBirth ? `${item.dateOfBirth}${years != null ? ` (${years})` : ""}` : "—"],
          ["Account name", item.accountName],
          ["Submitted", fmt(item.submittedAt)],
          ["Reviewed", item.reviewedAt ? `${fmt(item.reviewedAt)} by ${item.reviewedBy || "—"}` : "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{k}</dt>
            <dd className="font-medium text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      {item.socialProofUrl && (
        <p className="mt-3 text-sm">
          <span className="text-slate-500">Social: </span>
          <a href={item.socialProofUrl} target="_blank" rel="noreferrer noopener" className="font-medium text-emerald-700 hover:underline">
            {item.socialProofUrl}
          </a>
        </p>
      )}
      {item.authorityNote && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Manager authority</p>
          <p className="mt-1 whitespace-pre-line">{item.authorityNote}</p>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <DocumentPreview userId={item.userId} kind="id" label="ID document" />
        <DocumentPreview userId={item.userId} kind="selfie" label="Selfie with ID" />
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-800">Checklist</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Name and date of birth on the document match the details above</li>
          <li>The face in the selfie matches the ID photo, and the ID in the selfie is the same document</li>
          <li>Document isn't expired, cropped or edited; the social profile belongs to this artist</li>
        </ul>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ decision: "approve_full" })}
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-emerald-500/25 hover:bg-emerald-400 disabled:opacity-50"
        >
          Approve — verified artist
        </button>
        <button
          type="button"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ decision: "approve_identity" })}
          className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Approve identity only
        </button>
        {!rejecting && (
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="rounded-full border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            Reject…
          </button>
        )}
      </div>
      {!pending && <p className="mt-2 text-xs text-slate-400">Changing a past decision notifies the artist again.</p>}

      <AnimatePresence>
        {rejecting && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              decide.mutate({ decision: "reject", reason });
            }}
          >
            <label className="mb-1 mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reason (sent to the artist)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The selfie doesn't clearly show your ID — please retake it in good light."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                disabled={decide.isPending || reason.trim().length < 5}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Reject submission
              </button>
              <button type="button" onClick={() => setRejecting(false)} className="rounded-full px-4 py-2 text-sm text-slate-600">
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AdminVerifications() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("pending_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["review-queue", tab],
    queryFn: () => fetchReviewQueue(tab),
    enabled: Boolean(user?.isAdmin),
    refetchInterval: 30_000,
  });
  const selected = items.find((i) => i.userId === selectedId) || items[0] || null;

  if (!user?.isAdmin) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <NavBar />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="text-2xl font-black text-slate-900">Admins only</h1>
          <p className="mt-2 text-sm text-slate-500">This page is for The LineUp's verification team.</p>
          <Link to="/" className="mt-6 inline-block text-sm font-semibold text-emerald-700">
            ← Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-mobile-nav">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">Admin</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Artist verifications</h1>
        <p className="mt-1 text-sm text-slate-500">Check each ID against the selfie before approving. Every file view is logged.</p>

        <div className="mt-5 inline-flex flex-wrap rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setSelectedId(null);
              }}
              className="relative rounded-full px-4 py-1.5 text-sm font-semibold"
            >
              {tab === t.key && (
                <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-full bg-slate-900" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <span className={`relative ${tab === t.key ? "text-white" : "text-slate-600"}`}>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-2">
            {isLoading ? (
              [0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)
            ) : isError ? (
              <p className="text-sm text-rose-600">Couldn't load the queue.</p>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                {tab === "pending_review" ? "All caught up — nothing to review." : "Nothing here yet."}
              </div>
            ) : (
              items.map((i) => (
                <button
                  key={i.userId}
                  type="button"
                  onClick={() => setSelectedId(i.userId)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selected?.userId === i.userId ? "border-slate-900 bg-white shadow-md" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="truncate text-sm font-bold text-slate-900">{i.legalName || i.accountName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {i.stageName || i.accountEmail} · {fmt(i.submittedAt)}
                  </p>
                  {i.reviewNotes && <p className="mt-1 text-[11px] font-semibold text-amber-700">⚠ Possible duplicate ID</p>}
                </button>
              ))
            )}
          </aside>
          <section>
            <AnimatePresence mode="wait">
              {selected ? (
                <ReviewPanel key={selected.userId} item={selected} onDone={() => setSelectedId(null)} />
              ) : null}
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
}
