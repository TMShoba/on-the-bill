import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import type { Artist, TravelRequirements } from "../../Types/Artist";
import { useAuth } from "../../context/AuthContext";
import { useCurrency } from "../../context/CurrencyContext";
import { addPromoterBookingAsync, DEMO_PROMOTER } from "../../Services/demoStore";
import { mockMessagingApi } from "../../Services/mockMessagingApi";
import {
  type PaymentMethod,
  type ManualPaymentDetails,
  redirectToPayFast,
  getManualPaymentDetails,
  payfastAmountFor,
} from "../../Services/payfastService";
import { getFeeBreakdown } from "../../Services/platformFees";
import { DEFAULT_TRAVEL, detectCountry } from "../../Services/international";
import { priceDisplay, priceFloor } from "../../Services/pricing";
import InternationalFields from "./InternationalFields";
import CurrencySelect from "./CurrencySelect";

type Props = {
  artist: Artist;
  open: boolean;
  onClose: () => void;
  /** Dates (YYYY-MM-DD) the artist has marked unavailable */
  blockedDates?: string[];
};

const EASE = [0.22, 1, 0.36, 1] as const;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ step, children }: { step: number; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
        {step}
      </span>
      {children}
    </p>
  );
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Booking request in a modal: bottom sheet on phones, centred dialog on larger
 * screens. The form mounts fresh each time it opens.
 */
export default function BookingModal({ artist, open, onClose, blockedDates = [] }: Props) {
  // Esc closes; lock page scroll behind the dialog
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Portalled so no transformed ancestor can trap the fixed overlay
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="booking-modal"
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close booking"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
            className="relative z-10 flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 48, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <BookingDialog artist={artist} onClose={onClose} blockedDates={blockedDates} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function BookingDialog({
  artist,
  onClose,
  blockedDates,
}: {
  artist: Artist;
  onClose: () => void;
  blockedDates: string[];
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const { estimate, currency } = useCurrency();

  const detected = useMemo(() => detectCountry(), []);
  const [country, setCountry] = useState(detected?.code || "ZA");
  const [timezone, setTimezone] = useState(detected?.timezones[0] || "Africa/Johannesburg");
  const [travel, setTravel] = useState<TravelRequirements>(DEFAULT_TRAVEL);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("20:00");
  // Promoters normally see the exact rate; fall back to the band's low end if not
  const [fee, setFee] = useState<number>(priceFloor(artist) ?? 0);
  const price = priceDisplay(artist);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [manualDetails, setManualDetails] = useState<ManualPaymentDetails | null>(null);

  const startFees = useMemo(() => getFeeBreakdown(priceFloor(artist) ?? 0), [artist]);
  const fees = useMemo(() => getFeeBreakdown(fee || 0), [fee]);
  const international = country !== "ZA";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setManualDetails(null);
    const form = new FormData(e.currentTarget);
    const venue = String(form.get("venue") || "");
    const message = String(form.get("message") || "");

    try {
      const gig = await addPromoterBookingAsync({
        artistId: artist.id,
        artistName: artist.stageName,
        eventDate: date,
        time,
        venue,
        address: String(form.get("address") || ""),
        city: String(form.get("city") || ""),
        fee,
        message,
        clientName: user?.name || DEMO_PROMOTER.name,
        clientEmail: user?.email || DEMO_PROMOTER.email,
        eventCountry: country,
        eventTimezone: timezone,
        travel: international ? travel : undefined,
      });

      try {
        await mockMessagingApi.ensureConversationForBooking({
          bookingId: gig.id,
          artistId: artist.id,
          artistName: artist.stageName,
          promoterId: user?.id || DEMO_PROMOTER.id,
          promoterName: user?.name || DEMO_PROMOTER.name,
          initialMessage: message || `Hi! I'd like to book you for ${venue} on ${date}.`,
        });
      } catch {
        /* messaging optional */
      }

      if (paymentMethod === "card") {
        const { amount } = payfastAmountFor(fee, "deposit");
        redirectToPayFast({
          amount,
          itemName: `Deposit: ${artist.stageName} — ${venue}`,
          itemDescription: `Deposit + platform fee · ${date} ${time}`.trim(),
          email: user?.email,
          nameFirst: user?.name?.split(" ")[0],
          nameLast: user?.name?.split(" ").slice(1).join(" ") || undefined,
          customStr1: gig.id,
          customStr2: artist.id,
          returnUrl: `${window.location.origin}/dashboard?payment=success&ref=${gig.id}`,
          cancelUrl: `${window.location.origin}/artists/${artist.id}?payment=cancelled`,
        });
        return;
      }

      setManualDetails(getManualPaymentDetails(fees.depositTotal, gig.id));
      setSuccess(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to send booking request";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const money = (zar: number) => (
    <span className="text-right">
      <span className="font-semibold text-slate-900">R{zar.toLocaleString()}</span>
      {estimate(zar) && <span className="block text-[11px] text-slate-500">{estimate(zar)}</span>}
    </span>
  );

  return (
    <>
      {/* Title bar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">
            {success ? "Request sent" : "Request a booking"}
          </p>
          <h2 id="booking-modal-title" className="truncate text-lg font-black tracking-tight text-slate-900">
            {artist.stageName}
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
      {/* Price header */}
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {price.kind === "band" ? "Typical fee" : price.kind === "hidden" ? "Fee" : "Starting from"}
            </p>
            <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">{price.label}</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={currency}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm font-medium text-emerald-700"
              >
                {(price.amount != null && estimate(price.amount)) ||
                  (price.kind === "hidden" ? "Make an offer below" : "South African rand")}
              </motion.p>
            </AnimatePresence>
          </div>
          <CurrencySelect />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {startFees.depositTotal > 0 ? (
            <>
              Secure the date with a deposit of{" "}
              <span className="font-semibold text-slate-800">R{startFees.depositTotal.toLocaleString()}</span>
              {estimate(startFees.depositTotal) && ` (${estimate(startFees.depositTotal)})`}.{" "}
            </>
          ) : (
            "Enter your offer and the deposit is worked out for you. "
          )}
          The artist receives their full fee. All payments are charged in ZAR.
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="p-5 sm:p-6"
          >
            <div className="flex flex-col items-center text-center">
              <motion.svg viewBox="0 0 52 52" className="h-16 w-16">
                <motion.circle
                  cx="26" cy="26" r="24" fill="none" stroke="#10b981" strokeWidth="3"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
                <motion.path
                  d="M15 27l7 7 15-16" fill="none" stroke="#10b981" strokeWidth="4"
                  strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.5, ease: EASE }}
                />
              </motion.svg>
              <h3 className="mt-3 text-lg font-bold text-slate-900">Request sent to {artist.stageName}</h3>
              <p className="mt-1 text-sm text-slate-500">
                You'll get a notification when they respond. Chat with them any time in Messages.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Go to dashboard
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            {manualDetails && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-bold text-slate-900">Bank transfer details</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Use the reference exactly so we can match your payment.
                  {international && " Paying from abroad? Send ZAR via SWIFT and cover your bank's fees."}
                </p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {[
                    ["Bank", manualDetails.bankName],
                    ["Account name", manualDetails.accountName],
                    ["Account number", manualDetails.accountNumber],
                    ["Branch code", manualDetails.branchCode],
                    ["Reference", manualDetails.reference],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="font-mono font-medium text-slate-900">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
                    <dt className="text-slate-500">Deposit</dt>
                    <dd>{money(manualDetails.amount)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="space-y-5 p-5 sm:p-6"
          >
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <section className="space-y-3">
              <SectionTitle step={1}>When & where</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Event date">
                  <input
                    type="date"
                    required
                    min={todayIso()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={blockedDates.includes(date)}
                    className={`${inputClass} ${blockedDates.includes(date) ? "border-rose-300 ring-2 ring-rose-200" : ""}`}
                  />
                  {blockedDates.includes(date) && (
                    <p className="mt-1 text-xs font-medium text-rose-600">{artist.stageName} isn't available that day.</p>
                  )}
                </Field>
                <Field label="Start time (venue time)">
                  <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <InternationalFields
                country={country}
                timezone={timezone}
                date={date}
                time={time}
                travel={travel}
                onCountryChange={(code, tz) => {
                  setCountry(code);
                  setTimezone(tz);
                }}
                onTimezoneChange={setTimezone}
                onTravelChange={setTravel}
              />
              <Field label="Venue">
                <input name="venue" required placeholder={international ? "e.g. Printworks London" : "e.g. Sandton Convention Centre"} className={inputClass} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="City">
                  <input name="city" required placeholder={international ? "e.g. London" : "e.g. Johannesburg"} className={inputClass} />
                </Field>
                <Field label="Address">
                  <input name="address" placeholder="Street address" className={inputClass} />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle step={2}>Offer</SectionTitle>
              <Field label="Performance fee (ZAR)">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">R</span>
                  <input
                    type="number"
                    min={5}
                    required
                    value={fee || ""}
                    onChange={(e) => setFee(Number(e.target.value))}
                    className={`${inputClass} pl-8`}
                  />
                </div>
                {estimate(fee || 0) && (
                  <p className="mt-1 text-xs text-slate-500">{estimate(fee || 0)} at today's rate</p>
                )}
              </Field>
              <Field label="Message to the artist">
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Tell them about the event, audience size, set length…"
                  className={inputClass}
                />
              </Field>
            </section>

            <section className="space-y-3">
              <SectionTitle step={3}>Payment</SectionTitle>
              <div className="grid gap-2">
                {(
                  [
                    ["card", "Card (PayFast)", "Visa, Mastercard or Instant EFT. Charged in ZAR."],
                    ["manual", "Bank transfer", international ? "International SWIFT transfer in ZAR." : "Pay by EFT; the date is held once funds clear."],
                  ] as const
                ).map(([value, title, hint]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      paymentMethod === value ? "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-300" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={paymentMethod === value}
                      onChange={() => setPaymentMethod(value)}
                      className="mt-1 accent-emerald-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{title}</span>
                      <span className="text-xs text-slate-500">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              {fees.performanceFee > 0 && (
                <motion.dl layout className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="flex items-start justify-between gap-2">
                    <dt>Performance fee</dt>
                    <dd>{money(fees.performanceFee)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <dt>Platform fee</dt>
                    <dd>{money(fees.platformFee)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-t border-slate-200 pt-2">
                    <dt className="font-bold text-slate-900">Deposit due now</dt>
                    <dd className="text-emerald-700">{money(fees.depositTotal)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <dt>Total if paid upfront</dt>
                    <dd>{money(fees.fullTotal)}</dd>
                  </div>
                  {currency !== "ZAR" && (
                    <p className="pt-1 text-[11px] text-slate-400">
                      Estimates in {currency} for reference only. You're charged in ZAR; your bank sets the final exchange rate.
                    </p>
                  )}
                </motion.dl>
              )}
            </section>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <motion.button
                type="submit"
                disabled={submitting || blockedDates.includes(date)}
                whileTap={{ scale: 0.98 }}
                className="flex-1 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <motion.span
                      className="h-4 w-4 rounded-full border-2 border-slate-950/30 border-t-slate-950"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    />
                    Sending…
                  </span>
                ) : paymentMethod === "card" ? (
                  "Send request & pay deposit"
                ) : (
                  "Send request & get bank details"
                )}
              </motion.button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      </div>
    </>
  );
}
