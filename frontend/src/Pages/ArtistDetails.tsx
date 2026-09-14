import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import { useArtist } from "../hooks/useArtists";
import { useAuth } from "../context/AuthContext";
import {
  addPromoterBookingAsync,
  getDemoGigs,
  DEMO_ARTIST,
  DEMO_PROMOTER,
} from "../Services/demoStore";
import { mockMessagingApi } from "../Services/mockMessagingApi";
import { resolveArtistImage } from "../utils/imageCdn";
import PublicAvailabilityCalendar, {
  confirmedDatesFromGigs,
} from "../components/PublicAvailabilityCalendar";
import {
  type PaymentMethod,
  redirectToPayFast,
  getManualPaymentDetails,
  payfastAmountFor,
  type ManualPaymentDetails,
} from "../Services/payfastService";
import { getStoredArtistPhoto } from "../components/ArtistPhotoUpload";
import { isFavorite, toggleFavorite } from "../Services/favoritesStore";
import CompletedBadge from "../components/CompletedBadge";
import VerificationBadge from "../components/VerificationBadge";
import { getVerification } from "../Services/verificationStore";
import Footer from "../components/Footer";
import { getArtistBadges } from "../Services/reputationStore";
import { getFeeBreakdown } from "../Services/platformFees";

export default function ArtistDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { data: artist, isLoading, isError } = useArtist(id);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [manualDetails, setManualDetails] =
    useState<ManualPaymentDetails | null>(null);
  const [saved, setSaved] = useState(false);

  const busyDates = useMemo(() => {
    const gigs = getDemoGigs();
    return confirmedDatesFromGigs(
      gigs.filter((g) => g.artistId === DEMO_ARTIST.id)
    );
  }, []);

  const profilePhoto = useMemo(() => {
    if (!artist) return undefined;
    return (
      getStoredArtistPhoto(artist.id) ||
      getStoredArtistPhoto(DEMO_ARTIST.id) ||
      undefined
    );
  }, [artist]);

  useEffect(() => {
    if (artist && user) {
      setSaved(isFavorite(user.id, artist.id));
    }
  }, [artist, user]);

  const badges = useMemo(
    () => (artist ? getArtistBadges(artist.id) : null),
    [artist]
  );
  const feePreview = useMemo(
    () => getFeeBreakdown(artist?.rate || 0),
    [artist]
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!artist) return;
    setSubmitting(true);
    setFormError("");
    setManualDetails(null);
    const form = new FormData(e.currentTarget);

    const payload = {
      artistId: artist.id,
      artistName: artist.stageName,
      eventDate: String(form.get("eventDate") || ""),
      venue: String(form.get("venue") || ""),
      address: String(form.get("address") || ""),
      city: String(form.get("city") || ""),
      time: String(form.get("time") || "20:00"),
      fee: Number(form.get("fee") || artist.rate),
      message: String(form.get("message") || ""),
    };

    try {
      let bookingId: string = crypto.randomUUID();

      // Always book the public catalog artist id so the row exists on the server
      const gig = await addPromoterBookingAsync({
        ...payload,
        artistId: artist.id,
        artistName: artist.stageName,
        clientName: user?.name || String(form.get("clientName") || DEMO_PROMOTER.name),
        clientEmail:
          user?.email ||
          String(form.get("clientEmail") || DEMO_PROMOTER.email),
      });
      bookingId = gig.id;

      try {
        await mockMessagingApi.ensureConversationForBooking({
          bookingId: gig.id,
          artistId: artist.id,
          artistName: artist.stageName,
          promoterId: user?.id || DEMO_PROMOTER.id,
          promoterName: user?.name || DEMO_PROMOTER.name,
          initialMessage:
            payload.message ||
            `Hi! I'd like to book you for ${payload.venue} on ${payload.eventDate}.`,
        });
      } catch {
        /* messaging optional */
      }

      if (paymentMethod === "card") {
        const { amount: chargeAmount } = payfastAmountFor(payload.fee, "deposit");
        redirectToPayFast({
          amount: chargeAmount,
          itemName: `Deposit: ${artist.stageName} — ${payload.venue}`,
          itemDescription: `Deposit + platform fee · ${payload.eventDate} ${payload.time || ""}`.trim(),
          email: user?.email,
          nameFirst: user?.name?.split(" ")[0],
          nameLast: user?.name?.split(" ").slice(1).join(" ") || undefined,
          customStr1: bookingId,
          customStr2: artist.id,
          returnUrl: `${window.location.origin}/dashboard?payment=success&ref=${bookingId}`,
          cancelUrl: `${window.location.origin}/artists/${artist.id}?payment=cancelled`,
        });
        return;
      }

      setManualDetails(getManualPaymentDetails(payload.fee, bookingId));
      setSuccess(true);
      setShowForm(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to send booking request";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex flex-col bg-white pb-mobile-nav">
        <NavBar />
        <div className="flex-1 w-full mx-auto max-w-6xl px-4 py-20">
          <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (isError || !artist) {
    return (
      <div className="min-h-dvh bg-white pb-mobile-nav">
        <NavBar />
        <div className="mx-auto max-w-6xl px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Artist not found</h1>
          <Link to="/artists" className="mt-6 inline-block text-emerald-600">
            ← Back to artists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white pb-mobile-nav">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
            <Link
              to="/artists"
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              All artists
            </Link>
          </div>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Log out
            </button>
          )}
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <div className="relative overflow-hidden rounded-3xl bg-slate-100 shadow-xl ring-1 ring-slate-900/5">
              <img
                src={
                  profilePhoto ||
                  resolveArtistImage(artist.imageUrl, artist.id, "full")
                }
                alt={artist.stageName}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                    {artist.genre} · {artist.location}
                  </p>
                  <h1 className="text-2xl font-extrabold text-white drop-shadow sm:text-3xl">
                    {artist.stageName}
                  </h1>
                </div>
                {badges?.completedBooking && (
                  <CompletedBadge label={badges.label} count={badges.completedCount} />
                )}
              </div>
            </div>

            {/* Lighter public-facing availability calendar */}
            <div className="mt-6">
              <h2 className="mb-2 text-lg font-bold text-slate-900">
                Availability
              </h2>
              <p className="mb-3 text-sm text-slate-500">
                Open dates promoters can request. Busy days are already
                confirmed.
              </p>
              <PublicAvailabilityCalendar busyDates={busyDates} />
            </div>
          </div>

          <div className="text-left">
            <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {artist.genre}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              {artist.stageName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-slate-500">{artist.location}</p>
              <VerificationBadge
                status={getVerification(artist.id).status}
                size="md"
                hideIfUnverified
              />
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-emerald-50/40 p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Starting from</p>
              <p className="mt-1 text-3xl font-extrabold text-emerald-600">
                R{artist.rate.toLocaleString()}+
              </p>
              {badges?.completedBooking && (
                <div className="mt-3">
                  <CompletedBadge
                    label={badges.label}
                    count={badges.completedCount}
                    size="md"
                  />
                </div>
              )}
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {feePreview.summary} Deposit from{" "}
                <span className="font-semibold text-slate-800">
                  R{feePreview.depositTotal.toLocaleString()}
                </span>
                .
              </p>
            </div>

            {artist.bio && (
              <div className="mt-8">
                <h2 className="text-lg font-bold text-slate-900">Biography</h2>
                <p className="mt-2 leading-relaxed text-slate-600">
                  {artist.bio}
                </p>
              </div>
            )}

            {success && (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Booking request sent!
                  {user?.role === "promoter" && (
                    <>
                      {" "}
                      Switch to the artist account to see it on the calendar and
                      in Messages.{" "}
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={() => navigate("/dashboard")}
                      >
                        Go to dashboard
                      </button>
                    </>
                  )}
                </div>

                {manualDetails && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900">
                      Manual bank transfer (EFT)
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Use these details to complete payment. Reference must
                      match so we can allocate funds.
                    </p>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Bank</dt>
                        <dd className="font-medium">{manualDetails.bankName}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Account name</dt>
                        <dd className="font-medium">
                          {manualDetails.accountName}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Account number</dt>
                        <dd className="font-mono font-medium">
                          {manualDetails.accountNumber}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Branch code</dt>
                        <dd className="font-mono font-medium">
                          {manualDetails.branchCode}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Reference</dt>
                        <dd className="font-mono font-semibold text-emerald-700">
                          {manualDetails.reference}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-t border-slate-100 pt-2">
                        <dt className="text-slate-500">Amount</dt>
                        <dd className="text-lg font-bold text-slate-900">
                          R{manualDetails.amount.toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            )}

            {!showForm ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="w-full rounded-xl bg-slate-900 px-8 py-4 text-base font-semibold text-white hover:bg-slate-800 sm:w-auto"
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate("/login");
                      return;
                    }
                    setShowForm(true);
                    setSuccess(false);
                    setManualDetails(null);
                  }}
                >
                  Request Booking
                </button>
                {isAuthenticated &&
                  (user?.role === "promoter" || user?.role === "client") &&
                  artist && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) return;
                        const now = toggleFavorite(user.id, artist);
                        setSaved(now);
                      }}
                      className={`inline-flex items-center gap-2 rounded-xl border px-5 py-4 text-sm font-semibold ${
                        saved
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {saved ? "♥ Saved" : "♡ Save for later"}
                    </button>
                  )}
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <h3 className="text-lg font-bold text-slate-900">
                  Request booking
                </h3>
                {formError && (
                  <p className="text-sm text-red-600">{formError}</p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Event date
                    </label>
                    <input
                      name="eventDate"
                      type="date"
                      required
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Time
                    </label>
                    <input
                      name="time"
                      type="time"
                      defaultValue="20:00"
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Venue
                  </label>
                  <input
                    name="venue"
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                    placeholder="Sandton Convention Centre"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Address
                    </label>
                    <input
                      name="address"
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                      placeholder="161 Maude St"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      City
                    </label>
                    <input
                      name="city"
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                      placeholder="Johannesburg"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fee (ZAR)
                  </label>
                  <input
                    name="fee"
                    type="number"
                    defaultValue={artist.rate}
                    min={5}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Message
                  </label>
                  <textarea
                    name="message"
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                    placeholder="Tell them about your event..."
                  />
                </div>

                {/* Payment method: card (PayFast) or manual EFT */}
                <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
                  <legend className="px-1 text-sm font-semibold text-slate-800">
                    Payment method
                  </legend>
                  <div className="mt-2 space-y-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50/50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="card"
                        checked={paymentMethod === "card"}
                        onChange={() => setPaymentMethod("card")}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          Card (PayFast)
                        </span>
                        <span className="text-xs text-slate-500">
                          Visa, Mastercard, Instant EFT via PayFast secure
                          checkout
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50/50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="manual"
                        checked={paymentMethod === "manual"}
                        onChange={() => setPaymentMethod("manual")}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          Manual bank transfer (EFT)
                        </span>
                        <span className="text-xs text-slate-500">
                          Pay from your bank; booking stays pending until funds
                          clear
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                {feePreview.performanceFee > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <p className="font-bold text-slate-900">Payment breakdown</p>
                    <dl className="mt-2 space-y-1.5 text-slate-600">
                      <div className="flex justify-between gap-2">
                        <dt>Performance fee</dt>
                        <dd className="font-medium text-slate-900">
                          R{feePreview.performanceFee.toLocaleString()}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Platform fee (promoter)</dt>
                        <dd className="font-medium text-slate-900">
                          R{feePreview.platformFee.toLocaleString()}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2 border-t border-slate-200 pt-1.5">
                        <dt className="font-semibold text-slate-900">
                          Deposit due now
                        </dt>
                        <dd className="font-bold text-emerald-700">
                          R{feePreview.depositTotal.toLocaleString()}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Full total if paid upfront</dt>
                        <dd className="font-medium">
                          R{feePreview.fullTotal.toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-slate-500">
                      {feePreview.summary}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {submitting
                      ? "Processing..."
                      : paymentMethod === "card"
                        ? "Pay deposit with PayFast"
                        : "Send request & get bank details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-xl border border-slate-300 px-6 py-2.5 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
