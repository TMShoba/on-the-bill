import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import BlurText from "../components/animations/BlurText";
import BrandLogo from "../components/BrandLogo";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { loginDemo, loginWithCredentials } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await loginWithCredentials(
        String(form.get("email") || ""),
        String(form.get("password") || "")
      );
      navigate("/dashboard");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function quickLogin(role: "artist" | "promoter") {
    loginDemo(role);
    navigate("/dashboard");
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-50 to-emerald-50/40 pb-mobile-nav">
      <NavBar />

      <div className="flex-1 w-full mx-auto flex max-w-md flex-col px-4 py-14 sm:py-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <BrandLogo to="/" size="lg" variant="dark" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              <BlurText
                text="Welcome back"
                delay={80}
                animateBy="words"
                direction="top"
                className="justify-center"
              />
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to manage bookings and requests
            </p>
          </div>

          {/* Demo quick login */}
          <div className="mb-6 space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Demo quick login
            </p>
            <button
              type="button"
              onClick={() => quickLogin("artist")}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-medium text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50 active:scale-[0.98]"
            >
              <span className="font-semibold">Artist — DJ Maphorisa</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                artist@thelineup.co.za · password Demo1234!
              </span>
            </button>
            <button
              type="button"
              onClick={() => quickLogin("promoter")}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-medium text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50 active:scale-[0.98]"
            >
              <span className="font-semibold">Promoter — Thabo Events</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                promoter@thelineup.co.za · password Demo1234!
              </span>
            </button>
          </div>

          <form className="space-y-5 text-left" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-emerald-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              to="/register"
              className="font-semibold text-slate-900 underline-offset-2 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
