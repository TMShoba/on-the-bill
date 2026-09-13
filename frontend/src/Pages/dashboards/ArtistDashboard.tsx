import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import GigCalendar from "../../components/GigCalendar";
import GigDetailsModal from "../../components/GigDetailsModal";
import RemindersPanel from "../../components/RemindersPanel";
import MessagesPanel from "../../components/Messages/MessagesPanel";
import ArtistPhotoUpload from "../../components/ArtistPhotoUpload";
import ProfileStrengthMeter from "../../components/ProfileStrengthMeter";
import EarningsStats from "../../components/EarningsStats";
import TrustEducation from "../../components/TrustEducation";
import ArtistVerificationPanel from "../../components/ArtistVerificationPanel";
import VerificationBadge from "../../components/VerificationBadge";
import {
  getVerification,
  isIdentityVerified,
} from "../../Services/verificationStore";
import {
  getDemoGigs,
  loadBookingsForUser,
  toggleReminderAsync,
  updateBookingStatusAsync,
  openBookingDisputeAsync,
  DEMO_ARTIST,
} from "../../Services/demoStore";
import type { Booking } from "../../Types/Artist";
import { useAuth } from "../../context/AuthContext";

type TabKey = "overview" | "calendar" | "profile" | "messages";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "calendar", label: "Calendar" },
  { key: "profile", label: "Profile" },
];

export default function ArtistDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) || "overview";
  const [tab, setTab] = useState<TabKey>(
    ["overview", "calendar", "profile", "messages"].includes(initialTab)
      ? initialTab
      : "overview"
  );
  const [gigs, setGigs] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [dayGigs, setDayGigs] = useState<Booking[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [responding, setResponding] = useState(false);
  const [profileTick, setProfileTick] = useState(0);
  const artistId = user?.id || DEMO_ARTIST.id;

  useEffect(() => {
    let cancelled = false;
    loadBookingsForUser()
      .then((list) => {
        if (!cancelled) setGigs(list);
      })
      .catch(() => {
        if (!cancelled) setGigs(getDemoGigs());
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const mine = useMemo(
    () => gigs.filter((g) => g.artistId === user?.id || true),
    [gigs, user]
  );

  const pendingRequests = useMemo(
    () => mine.filter((g) => g.status === "pending"),
    [mine]
  );

  const stats = useMemo(() => {
    return {
      confirmed: mine.filter((g) => g.status === "confirmed").length,
      pending: mine.filter((g) => g.status === "pending").length,
      declined: mine.filter((g) => g.status === "declined").length,
    };
  }, [mine]);

  async function refresh() {
    try {
      setGigs(await loadBookingsForUser());
    } catch {
      setGigs(getDemoGigs());
    }
  }

  function openGig(g: Booking) {
    setSelected(g);
    setModalOpen(true);
  }

  async function handleRespond(gigId: string, status: "confirmed" | "declined") {
    if (status === "confirmed" && !isIdentityVerified(user?.id || artistId)) {
      window.alert(
        "Complete artist verification before accepting bookings. Open Profile or Settings to verify."
      );
      setTab("profile");
      return;
    }
    setResponding(true);
    try {
      const updated = await updateBookingStatusAsync(gigId, status);
      await refresh();
      if (updated) setSelected(updated);
    } finally {
      setResponding(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Artist
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Hey, {user?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            Availability, requests, earnings & messages
          </p>
          <div className="mt-2">
            <VerificationBadge
              status={getVerification(user?.id || artistId).status}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/settings"
            className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:inline-flex"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:inline-flex"
          >
            Log out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-14 z-20 -mx-3 mb-6 overflow-x-auto border-y border-slate-200/80 bg-slate-50/95 px-3 py-2 backdrop-blur scrollbar-none sm:static sm:mx-0 sm:border-none sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex w-max gap-1.5 sm:w-full sm:gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                if (t.key === "messages") {
                  setSearchParams({ tab: "messages" });
                } else if (searchParams.get("tab")) {
                  setSearchParams({});
                }
              }}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              } ${t.key === "overview" && pendingRequests.length > 0 ? "relative" : ""}`}
            >
              {t.label}
              {t.key === "overview" && pendingRequests.length > 0 && (
                <span className="ml-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Confirmed</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.confirmed}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Pending requests</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Declined</p>
              <p className="text-2xl font-bold text-rose-500">{stats.declined}</p>
            </div>
          </div>

          <EarningsStats gigs={mine} />

          {pendingRequests.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Booking requests awaiting your response
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Promoters have requested these dates. Accept to confirm or decline if
                you are unavailable.
              </p>
              <ul className="mt-4 space-y-3">
                {pendingRequests.map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {g.venue || "Event"} · {g.eventDate}
                        {g.time ? ` · ${g.time}` : ""}
                      </p>
                      <p className="text-sm text-slate-500">
                        {g.promoterName || g.clientName}
                        {g.city ? ` · ${g.city}` : ""}
                        {typeof g.fee === "number"
                          ? ` · R${g.fee.toLocaleString()}`
                          : ""}
                      </p>
                      {g.message && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {g.message}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openGig(g)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        disabled={responding}
                        onClick={() => handleRespond(g.id, "declined")}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={responding}
                        onClick={() => openGig(g)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Accept
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <RemindersPanel gigs={mine} onOpenGig={openGig} />

          <TrustEducation compact />
        </div>
      )}

      {tab === "calendar" && (
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-900">Availability calendar</h2>
            <p className="text-sm text-slate-500">
              Confirmed, pending and declined gigs on your schedule. Tap a day to
              review or respond.
            </p>
          </div>
          <GigCalendar
            gigs={mine}
            onSelectDay={(_date, list) => {
              setDayGigs(list);
              if (list.length === 1) {
                openGig(list[0]);
              } else if (list.length > 1) {
                setSelected(null);
                setModalOpen(false);
              }
            }}
            onSelectGig={openGig}
          />

          {dayGigs.length > 1 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-bold text-slate-900">Gigs on this day</h3>
              <ul className="space-y-2">
                {dayGigs.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => openGig(g)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium">{g.venue}</span>
                      <span className="capitalize text-slate-500">{g.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "profile" && (
        <div className="space-y-6">
          <ArtistVerificationPanel userId={user?.id || artistId} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ProfileStrengthMeter artistId={artistId} hasPublicBio refreshKey={profileTick} />
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-slate-900">Profile photo</h2>
              <ArtistPhotoUpload
                artistId={artistId}
                onPhotoChange={() => setProfileTick((n) => n + 1)}
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 lg:col-span-2">
              Payout details have moved to{" "}
              <Link to="/dashboard/settings" className="font-semibold text-emerald-700 hover:underline">
                Settings
              </Link>
              .
            </div>
          </div>
        </div>
      )}

      {tab === "messages" && <MessagesPanel />}

      <GigDetailsModal
        open={modalOpen}
        gig={selected}
        onClose={() => setModalOpen(false)}
        showReminderToggle
        canRespond
        responding={responding}
        onRespond={handleRespond}
        onDispute={async (id, reason) => {
          const updated = await openBookingDisputeAsync(id, reason);
          await refresh();
          if (updated) setSelected(updated);
        }}
        onToggleReminder={async (id, value) => {
          await toggleReminderAsync(id, value);
          await refresh();
          setSelected((prev) =>
            prev && prev.id === id ? { ...prev, reminderOptIn: value } : prev
          );
        }}
      />
    </div>
  );
}
