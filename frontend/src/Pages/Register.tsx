import {type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import { register, saveAuth } from "../Services/authService";

export default function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);

    try {
      const res = await register({
        name: String(form.get("name") || ""),
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        role: (form.get("role") as "client" | "artist") || "client",
      });
      saveAuth(res.token, res.user);
      navigate("/dashboard");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Registration failed. Is the API running?";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-50 to-emerald-50/40 pb-mobile-nav">
      <NavBar />

      <div className="flex-1 w-full mx-auto flex max-w-md flex-col px-4 py-14 sm:py-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-extrabold text-slate-900">
              Create account
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Join as a client or artist
            </p>
          </div>

          <form className="space-y-5 text-left" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="Thabo Molefe"
              />
            </div>

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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
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
                required
                minLength={6}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="********"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                I want to
              </label>
              <select
                id="role"
                name="role"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                defaultValue="client"
              >
                <option value="client">Book artists</option>
                <option value="artist">List myself as an artist</option>
              </select>
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" required className="mt-0.5 rounded border-slate-300" />
              <span>
                I agree to the{" "}
                <Link to="/legal/terms" className="font-semibold text-emerald-700 underline">
                  Terms of use
                </Link>
                ,{" "}
                <Link to="/legal/privacy" className="font-semibold text-emerald-700 underline">
                  Privacy policy
                </Link>
                , and{" "}
                <Link to="/legal/cancellation" className="font-semibold text-emerald-700 underline">
                  Cancellation rules
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-slate-900 underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
