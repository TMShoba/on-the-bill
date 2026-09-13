import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Booking } from "../Types/Artist";
import { getBankingDetails } from "../Services/artistProfileStore";
import { getReceiptsForBooking } from "../Services/receiptStore";

type Props = {
  gig: Booking | null;
  open: boolean;
  onClose: () => void;
  onToggleReminder?: (gigId: string, value: boolean) => void;
  showReminderToggle?: boolean;
  canRespond?: boolean;
  onRespond?: (gigId: string, status: "confirmed" | "declined") => void;
  responding?: boolean;
  showArtistBanking?: boolean;
  canManagePayment?: boolean;
  onMarkPaid?: (gigId: string, mode: "deposit" | "paid") => void;
  onDispute?: (gigId: string, reason: string) => void;
};

const statusStyles: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  declined: "bg-rose-50 text-rose-700",
  paid: "bg-sky-50 text-sky-700",
};

const paymentStyles: Record<string, string> = {
  unpaid: "bg-slate-100 text-slate-600",
  deposit: "bg-amber-50 text-amber-800",
  paid: "bg-emerald-50 text-emerald-800",
  disputed: "bg-rose-50 text-rose-800",
};

const BOOKING_TERMS = [
  "The agreed performance fee and deposit terms apply to this booking.",
  "Artist will arrive ready to perform at the stated time and venue.",
  "Promoter will provide a safe venue and essential production as discussed.",
  "Cancellations follow The LineUp cancellation policy.",
  "Payment status on this booking is the shared record for both parties.",
];

export default function GigDetailsModal({
  gig,
  open,
  onClose,
  onToggleReminder,
  showReminderToggle,
  canRespond,
  onRespond,
  responding,
  showArtistBanking = false,
  canManagePayment = false,
  onMarkPaid,
  onDispute,
}: Props) {
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [receiptTick, setReceiptTick] = useState(0);

  const receipts = useMemo(() => {
    if (!gig) return [];
    void receiptTick;
    return getReceiptsForBooking(gig.id);
  }, [gig, receiptTick]);

  if (!open || !gig) return null;

  const showActions = canRespond && gig.status === "pending" && onRespond;
  const banking =
    showArtistBanking &&
    (gig.status === "confirmed" || gig.status === "paid")
      ? getBankingDetails(gig.artistId)
      : null;
  const payment =
    gig.paymentStatus || (gig.status === "paid" ? "paid" : "unpaid");

  function handleAcceptClick() {
    setTermsAgreed(false);
    setTermsOpen(true);
  }

  function handleConfirmAccept() {
    if (!termsAgreed || !onRespond || !gig) return;
    setTermsOpen(false);
    onRespond(gig.id, "confirmed");
  }

  function handleMarkPaid(mode: "deposit" | "paid") {
    onMarkPaid?.(gig!.id, mode);
    // allow receipts list to refresh after parent updates store
    window.setTimeout(() => setReceiptTick((n) => n + 1), 50);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Booking
            </p>
            <h2 className="text-xl font-black text-slate-900">
              {gig.venue || "Event"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {gig.eventDate}
              {gig.time ? ` · ${gig.time}` : ""}
              {gig.city ? ` · ${gig.city}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                statusStyles[gig.status] || statusStyles.pending
              }`}
            >
              {gig.status}
            </span>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                paymentStyles[payment] || paymentStyles.unpaid
              }`}
            >
              payment: {payment}
            </span>
          </div>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Artist</dt>
            <dd className="font-medium text-slate-900">{gig.artistName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Promoter</dt>
            <dd className="font-medium text-slate-900">
              {gig.promoterName || gig.clientName}
            </dd>
          </div>
          {typeof gig.fee === "number" && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Fee</dt>
              <dd className="font-semibold text-emerald-700">
                R{gig.fee.toLocaleString()}
              </dd>
            </div>
          )}
          {gig.address && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Address</dt>
              <dd className="text-right font-medium text-slate-900">
                {gig.address}
              </dd>
            </div>
          )}
          {gig.message && (
            <div>
              <dt className="text-slate-500">Message</dt>
              <dd className="mt-1 rounded-xl bg-slate-50 p-3 text-slate-800">
                {gig.message}
              </dd>
            </div>
          )}
        </dl>

        {/* —— Receipts —— */}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Receipts</h3>
            <span className="text-[11px] font-medium text-slate-400">
              Payment record for this booking
            </span>
          </div>
          {receipts.length === 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              No receipts yet. When a deposit or full payment is marked paid,
              a receipt appears here for both sides.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {receipts.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-white bg-white px-3 py-2.5 text-sm shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold capitalize text-slate-900">
                      {r.kind} payment
                    </span>
                    <span className="font-bold text-emerald-700">
                      R{r.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span className="capitalize">{r.status}</span>
                    <span className="uppercase">{r.method}</span>
                    <span>
                      {r.paidAt
                        ? new Date(r.paidAt).toLocaleString()
                        : new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Platform fee R{r.platformFee.toLocaleString()} · Artist
                    payout R{r.artistPayout.toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {banking && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm">
            <p className="font-bold text-emerald-900">Artist banking (EFT)</p>
            <p className="mt-1 text-emerald-900/80">
              {banking.bankName} · {banking.accountName}
            </p>
            <p className="font-mono text-xs text-emerald-900/70">
              Acc {banking.accountNumber} · Branch {banking.branchCode}
            </p>
          </div>
        )}

        {canManagePayment &&
          (gig.status === "confirmed" || gig.status === "paid") &&
          payment !== "disputed" && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment actions
              </p>
              <div className="flex flex-wrap gap-2">
                {payment !== "deposit" && payment !== "paid" && onMarkPaid && (
                  <button
                    type="button"
                    onClick={() => handleMarkPaid("deposit")}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Mark deposit paid
                  </button>
                )}
                {payment !== "paid" && onMarkPaid && (
                  <button
                    type="button"
                    onClick={() => handleMarkPaid("paid")}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Mark fully paid
                  </button>
                )}
              </div>
            </div>
          )}

        {canManagePayment &&
          payment !== "disputed" &&
          onDispute &&
          (gig.status === "confirmed" ||
            gig.status === "paid" ||
            payment === "deposit") && (
            <div className="mt-4">
              {!disputeOpen ? (
                <button
                  type="button"
                  onClick={() => setDisputeOpen(true)}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Open a dispute
                </button>
              ) : (
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="What went wrong? (payment, no-show, venue…)"
                    className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
                    rows={3}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={!disputeReason.trim()}
                      onClick={() => {
                        onDispute(gig.id, disputeReason.trim());
                        setDisputeOpen(false);
                        setDisputeReason("");
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Submit dispute
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisputeOpen(false)}
                      className="text-xs font-medium text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        {showReminderToggle &&
          onToggleReminder &&
          gig.status !== "declined" && (
            <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={Boolean(gig.reminderOptIn)}
                onChange={(e) => onToggleReminder(gig.id, e.target.checked)}
                className="h-4 w-4 rounded border-slate-200"
              />
              <span className="text-sm font-medium text-slate-800">
                Remind me about this gig
              </span>
            </label>
          )}

        {/* —— Accept / Decline —— */}
        {showActions && !termsOpen && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={responding}
              onClick={() => onRespond!(gig.id, "declined")}
              className="rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={responding}
              onClick={handleAcceptClick}
              className="rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Accept
            </button>
          </div>
        )}

        {/* —— Agreed terms step —— */}
        {showActions && termsOpen && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <h3 className="text-sm font-bold text-slate-900">
              Agree to booking terms
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Review these terms before you confirm. Both parties rely on this
              booking record.
            </p>
            <ul className="mt-3 space-y-2">
              {BOOKING_TERMS.map((line) => (
                <li
                  key={line}
                  className="flex gap-2 text-xs leading-relaxed text-slate-700"
                >
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              Full policy:{" "}
              <Link
                to="/legal/cancellation"
                className="font-semibold text-emerald-700 hover:underline"
                onClick={onClose}
              >
                Cancellation
              </Link>
              {" · "}
              <Link
                to="/legal/terms"
                className="font-semibold text-emerald-700 hover:underline"
                onClick={onClose}
              >
                Terms of use
              </Link>
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-emerald-200 bg-white p-3">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span className="text-xs font-medium text-slate-800">
                I agree to these terms for this booking
              </span>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!termsAgreed || responding}
                onClick={handleConfirmAccept}
                className="rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {responding ? "Saving…" : "Confirm accept"}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold ${
            showActions
              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          Close
        </button>
      </div>
    </div>
  );
}
