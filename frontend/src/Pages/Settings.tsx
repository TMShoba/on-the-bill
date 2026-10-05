import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import ToggleSwitch from "../components/ToggleSwitch";
import BankingDetailsForm from "../components/BankingDetailsForm";
import ArtistVerificationPanel from "../components/ArtistVerificationPanel";
import { useAuth } from "../context/AuthContext";
import { getSettings, saveSettings, clearLocalDemoData, useEmailNotifications } from "../Services/settingsStore";

export default function Settings() {
  const { user, isAuthenticated, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [nameSaved, setNameSaved] = useState(false);
  const [settings, setSettings] = useState(() =>
    user ? getSettings(user.id) : { emailNotifications: true, reminderDefaultOptIn: true }
  );
  const emailPref = useEmailNotifications(user?.id);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const currentUser = user;

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    updateUser({ name: trimmed });
    setNameSaved(true);
    window.setTimeout(() => setNameSaved(false), 2000);
  }

  function updateSetting<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    const next = saveSettings(currentUser.id, { [key]: value });
    setSettings(next);
  }

  function handleReset() {
    clearLocalDemoData();
    setResetConfirming(false);
    setResetDone(true);
  }

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 pb-mobile-nav">
      <NavBar />

      <div className="flex-1 w-full mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Go back"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Settings
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage your account, notifications{user.role === "artist" ? " and payout details" : ""}.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Account */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Account</h2>

            <form onSubmit={handleSaveName} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Display name
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Save
                  </button>
                </div>
                {nameSaved && (
                  <p className="mt-2 text-sm font-medium text-emerald-700">Saved ✓</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </label>
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                  {user.email}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-700">
                  {user.role}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Log out
                </button>
              </div>
            </form>
          </section>

          {/* Notifications */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
            <p className="mt-1 text-sm text-slate-500">
              Control what The LineUp lets you know about.
            </p>

            <div className="mt-4 space-y-4 divide-y divide-slate-100">
              <ToggleSwitch
                checked={emailPref.enabled}
                onChange={(v) => emailPref.setEnabled(v)}
                label="Email notifications"
                description="Booking requests, acceptances with your contract PDF, payment receipts and new messages"
              />
              {user.role === "artist" && (
                <div className="pt-4">
                  <ToggleSwitch
                    checked={settings.reminderDefaultOptIn}
                    onChange={(v) => updateSetting("reminderDefaultOptIn", v)}
                    label="Remind me about new gigs by default"
                    description="New booking requests start with reminders on — you can still turn it off per gig"
                  />
                </div>
              )}
            </div>
          </section>

          {user.role === "artist" && (
            <ArtistVerificationPanel userId={user.id} />
          )}

          {/* Banking details — artists only; gated on verification inside the form */}
          {user.role === "artist" && (
            <BankingDetailsForm />
          )}

          {/* Danger zone */}
          <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Reset demo data</h2>
            <p className="mt-1 text-sm text-slate-600">
              Clears bookings, messages, favorites and notifications stored on this device. Your
              login stays active. Useful before showing this to someone new.
            </p>

            {resetDone ? (
              <p className="mt-4 text-sm font-medium text-emerald-700">
                Done — refresh the page to see a clean slate.
              </p>
            ) : resetConfirming ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                >
                  Yes, clear everything
                </button>
                <button
                  type="button"
                  onClick={() => setResetConfirming(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setResetConfirming(true)}
                className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Reset demo data
              </button>
            )}
          </section>

          <p className="text-center text-xs text-slate-400">
            <Link to="/dashboard" className="font-medium text-slate-500 hover:text-slate-700">
              ← Back to dashboard
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
