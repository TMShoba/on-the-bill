import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import axios from "axios";
import {
  submitVerification,
  demoApproveFully,
  useMyVerification,
  verificationQueryKey,
  type ClaimType,
  type VerificationRecord,
} from "../Services/verificationStore";
import { validateSaId } from "../Services/saId";
import VerificationBadge from "./VerificationBadge";

type Props = {
  userId: string;
  onUpdated?: (rec: VerificationRecord) => void;
};

/** Demo approval is for local/demo builds only; the API also refuses it unless demo mode is on */
const SHOW_DEMO_APPROVE = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30";

function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) return e.response?.data?.message || fallback;
  return fallback;
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

const STEPS = ["Submit", "In review", "Verified"];

function Progress({ status }: { status: VerificationRecord["status"] }) {
  const active =
    status === "identity_verified" || status === "fully_verified" ? 2 : status === "pending_review" ? 1 : 0;
  return (
    <ol className="mt-4 flex items-center gap-2" aria-label="Verification progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
              i < active || (i === active && active === 2)
                ? "bg-emerald-500 text-white"
                : i === active
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            {i < active || (i === 2 && active === 2) ? "✓" : i + 1}
          </span>
          <span className={`text-xs font-semibold ${i <= active ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
          {i < STEPS.length - 1 && (
            <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <motion.span
                className="block h-full bg-emerald-500"
                initial={false}
                animate={{ width: i < active ? "100%" : "0%" }}
                transition={{ duration: 0.5 }}
              />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function FilePick({
  label,
  hint,
  accept,
  capture,
  maxMb,
  file,
  onFile,
  onError,
  alreadyOnFile,
}: {
  label: string;
  hint: string;
  accept: string;
  capture?: "user";
  maxMb: number;
  file: File | null;
  onFile: (f: File | null) => void;
  onError: (msg: string) => void;
  alreadyOnFile?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-3.5 py-3 text-left transition ${
          file ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            file ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {file ? "✓" : "↑"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {file ? file.name : alreadyOnFile ? "On file — tap to replace" : "Choose file"}
          </span>
          <span className="block text-xs text-slate-500">{hint}</span>
        </span>
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        capture={capture}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          if (f && f.size > maxMb * 1024 * 1024) {
            onError(`${label} must be ${maxMb} MB or smaller.`);
            onFile(null);
          } else onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function ArtistVerificationPanel({ userId, onUpdated }: Props) {
  const { data: rec, isLoading, isError } = useMyVerification(userId);

  if (isLoading) {
    return <section className="skeleton h-48 rounded-3xl" aria-label="Loading verification" />;
  }
  if (isError || !rec) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Could not load your verification status. Please refresh and try again.
      </section>
    );
  }
  return <VerificationCard userId={userId} rec={rec} onUpdated={onUpdated} />;
}

function Shell({ rec, children }: { rec: VerificationRecord; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">Trust</p>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Identity verification</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Required before you can accept paid bookings. Our team checks your ID against a selfie.
          </p>
        </div>
        <VerificationBadge status={rec.status} size="md" />
      </div>
      <Progress status={rec.status} />
      {children}
    </section>
  );
}

function VerificationCard({ userId, rec, onUpdated }: { userId: string; rec: VerificationRecord; onUpdated?: Props["onUpdated"] }) {
  const qc = useQueryClient();
  const verified = rec.status === "identity_verified" || rec.status === "fully_verified";
  const [editing, setEditing] = useState(rec.status === "unverified" || rec.status === "rejected");
  const [claimType, setClaimType] = useState<ClaimType>(rec.claimType || "self");
  const [legalName, setLegalName] = useState(rec.legalName);
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [authorityNote, setAuthorityNote] = useState(rec.authorityNote);
  const [socialProofUrl, setSocialProofUrl] = useState(rec.socialProofUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const idCheck = useMemo(() => (idNumber.replace(/\s/g, "").length ? validateSaId(idNumber) : null), [idNumber]);
  const needsDocs = !rec.hasIdDocument || !rec.hasSelfie;
  const canSubmit =
    !busy &&
    legalName.trim().length >= 3 &&
    idCheck?.valid === true &&
    (idFile || rec.hasIdDocument) &&
    (selfieFile || rec.hasSelfie) &&
    (claimType === "self" || authorityNote.trim().length >= 20);

  function refresh(next: VerificationRecord) {
    qc.setQueryData(verificationQueryKey(userId), next);
    onUpdated?.(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setMsg("");
    try {
      const next = await submitVerification({
        claimType,
        legalName: legalName.trim(),
        idNumber: idNumber.replace(/\s/g, ""),
        idDocument: idFile ? await readFile(idFile) : undefined,
        selfie: selfieFile ? await readFile(selfieFile) : undefined,
        authorityNote,
        socialProofUrl,
      });
      setIdNumber("");
      setIdFile(null);
      setSelfieFile(null);
      setEditing(false);
      refresh(next);
    } catch (err) {
      setMsg(errorMessage(err, "Could not submit verification. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function demoApprove() {
    setBusy(true);
    setMsg("");
    try {
      refresh(await demoApproveFully());
    } catch (err) {
      setMsg(errorMessage(err, "Demo approval is not available."));
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return (
      <Shell rec={rec}>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg text-white">✓</span>
          <p>
            <span className="font-semibold">You're verified{rec.legalName ? `, ${rec.legalName.split(" ")[0]}` : ""}.</span>{" "}
            Reviewed {formatDate(rec.reviewedAt)}. Promoters see a verified badge on your profile.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell rec={rec}>
      <AnimatePresence initial={false} mode="wait">
        {!editing ? (
          <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5">
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Your documents are with our review team</p>
              <p className="mt-1 text-amber-800/80">
                Submitted {formatDate(rec.submittedAt)} as {rec.legalName} (ID ending {rec.idNumberLast4}). Reviews
                usually take one business day; we'll email you the outcome.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Update submission
              </button>
              {SHOW_DEMO_APPROVE && (
                <button
                  type="button"
                  onClick={demoApprove}
                  disabled={busy}
                  className="rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Demo: approve now
                </button>
              )}
            </div>
            {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 space-y-4"
          >
            {rec.status === "rejected" && rec.rejectionReason && (
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
                <p className="font-semibold">Your last submission wasn't approved</p>
                <p className="mt-1">{rec.rejectionReason}</p>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Who is verifying">
              {(
                [
                  ["self", "I'm the artist", "Verify with your own ID"],
                  ["manager", "I'm the manager", "Verify with your ID + proof of authority"],
                ] as const
              ).map(([value, title, sub]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={claimType === value}
                  onClick={() => setClaimType(value)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    claimType === value ? "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-300" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-900">{title}</span>
                  <span className="text-xs text-slate-500">{sub}</span>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Full legal name</label>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="As on your ID"
                  autoComplete="name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">SA ID number</label>
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value.replace(/[^\d\s]/g, "").slice(0, 16))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={rec.idNumberLast4 ? `Re-enter (ends ${rec.idNumberLast4})` : "13 digits"}
                  aria-invalid={idCheck?.valid === false}
                  className={`${inputClass} font-mono tracking-wider ${
                    idCheck?.valid === false ? "border-rose-300 focus:border-rose-400 focus:ring-rose-300/30" : ""
                  }`}
                />
                <p className={`mt-1 min-h-4 text-xs ${idCheck?.valid ? "text-emerald-700" : "text-rose-600"}`}>
                  {idCheck?.valid
                    ? `✓ Valid · born ${formatDate(idCheck.dateOfBirth)}`
                    : idCheck && idNumber.replace(/\s/g, "").length >= 13
                      ? idCheck.reason
                      : ""}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FilePick
                label="ID document"
                hint="Green ID book, smart ID card (both sides) or PDF · max 8 MB"
                accept="application/pdf,image/jpeg,image/png"
                maxMb={8}
                file={idFile}
                onFile={setIdFile}
                onError={setMsg}
                alreadyOnFile={rec.hasIdDocument}
              />
              <FilePick
                label="Selfie holding your ID"
                hint="Face and ID clearly visible · JPG/PNG · max 5 MB"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                maxMb={5}
                file={selfieFile}
                onFile={setSelfieFile}
                onError={setMsg}
                alreadyOnFile={rec.hasSelfie}
              />
            </div>

            <AnimatePresence initial={false}>
              {claimType === "manager" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Your authority to represent the artist
                  </label>
                  <textarea
                    rows={3}
                    value={authorityNote}
                    onChange={(e) => setAuthorityNote(e.target.value)}
                    placeholder="e.g. Management agreement since 2023 with Kasi Records; artist's email for confirmation…"
                    className={inputClass}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Official social profile <span className="font-normal normal-case text-slate-400">(optional, speeds up review)</span>
              </label>
              <input
                type="url"
                value={socialProofUrl}
                onChange={(e) => setSocialProofUrl(e.target.value)}
                placeholder="https://instagram.com/…"
                className={inputClass}
              />
            </div>

            <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
              🔒 We keep only the last 4 digits of your ID number. Your documents are stored privately and only seen by
              The LineUp's review team, in line with POPIA.
            </p>

            {msg && <p className="text-sm text-rose-600">{msg}</p>}
            {needsDocs && !idFile && !selfieFile && !msg && (
              <p className="text-xs text-slate-400">Add your ID document and selfie to submit.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Uploading securely…" : rec.status === "pending_review" ? "Resubmit for review" : "Submit for review"}
              </button>
              {rec.status === "pending_review" && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
              )}
              {SHOW_DEMO_APPROVE && (
                <button
                  type="button"
                  onClick={demoApprove}
                  disabled={busy}
                  className="rounded-full border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Demo: approve now
                </button>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </Shell>
  );
}
