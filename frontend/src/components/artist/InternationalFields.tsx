import { AnimatePresence, motion } from "motion/react";
import type { TravelRequirements } from "../../Types/Artist";
import {
  COUNTRIES,
  eventTimeForArtist,
  findCountry,
  zoneLabel,
} from "../../Services/international";

type Props = {
  country: string;
  timezone: string;
  date: string;
  time: string;
  travel: TravelRequirements;
  onCountryChange: (code: string, timezone: string) => void;
  onTimezoneChange: (tz: string) => void;
  onTravelChange: (travel: TravelRequirements) => void;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30";

const TRAVEL_OPTIONS: { key: keyof TravelRequirements; label: string; hint: string }[] = [
  { key: "flights", label: "Return flights", hint: "From Johannesburg (JNB)" },
  { key: "accommodation", label: "Accommodation", hint: "Hotel for the travelling party" },
  { key: "groundTransport", label: "Ground transport", hint: "Airport ↔ hotel ↔ venue" },
  { key: "visaSupport", label: "Visa invitation letter", hint: "If the country requires one" },
];

export default function InternationalFields({
  country,
  timezone,
  date,
  time,
  travel,
  onCountryChange,
  onTimezoneChange,
  onTravelChange,
}: Props) {
  const selected = findCountry(country);
  const international = country !== "ZA";
  const artistTime = international && date && time ? eventTimeForArtist(date, time, timezone) : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Event country
          </label>
          <select
            value={country}
            onChange={(e) => {
              const next = findCountry(e.target.value);
              if (next) onCountryChange(next.code, next.timezones[0]);
            }}
            className={inputClass}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Venue time zone
          </label>
          <select
            value={timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
            disabled={(selected?.timezones.length || 0) < 2}
            className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-500`}
          >
            {(selected?.timezones || [timezone]).map((tz) => (
              <option key={tz} value={tz}>
                {zoneLabel(tz)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {international && (
          <motion.div
            key="intl"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {/* Time conversion */}
              <AnimatePresence mode="wait">
                {artistTime && (
                  <motion.div
                    key={`${artistTime.date}-${artistTime.time}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-sm text-sky-900"
                  >
                    <svg className="h-5 w-5 shrink-0 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="9" />
                      <path strokeLinecap="round" d="M12 7v5l3 2" />
                    </svg>
                    <p>
                      <span className="font-semibold">
                        {time} in {zoneLabel(timezone)}
                      </span>{" "}
                      is <span className="font-semibold">{artistTime.time} SAST</span> for the artist
                      {artistTime.dayShift !== 0 && (
                        <span className="font-semibold">
                          {" "}
                          ({artistTime.dayShift > 0 ? "next day" : "previous day"}, {artistTime.date})
                        </span>
                      )}
                      .{" "}
                      <span className="text-sky-700/80">
                        {artistTime.diffHours === 0
                          ? "Same time zone as South Africa."
                          : `${Math.abs(artistTime.diffHours)}h ${artistTime.diffHours > 0 ? "ahead of" : "behind"} South Africa.`}
                      </span>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Travel */}
              <fieldset className="rounded-xl border border-slate-200 bg-white p-3.5">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Travel you'll cover
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TRAVEL_OPTIONS.map((opt) => {
                    const checked = Boolean(travel[opt.key]);
                    return (
                      <label
                        key={opt.key}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition ${
                          checked ? "border-emerald-300 bg-emerald-50/60" : "border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => onTravelChange({ ...travel, [opt.key]: e.target.checked })}
                          className="mt-0.5 h-4 w-4 accent-emerald-500"
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-900">{opt.label}</span>
                          <span className="text-xs text-slate-500">{opt.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Travelling party</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={travel.crewSize}
                      onChange={(e) =>
                        onTravelChange({ ...travel, crewSize: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Travel notes</label>
                    <input
                      value={travel.notes || ""}
                      onChange={(e) => onTravelChange({ ...travel, notes: e.target.value })}
                      placeholder="e.g. Business class for artist, arrive day before"
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  These go into the booking contract, so the artist knows exactly what's
                  covered before accepting.
                </p>
              </fieldset>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
