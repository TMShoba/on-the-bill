import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../Services/api";
import { CURRENCIES, detectCountry, formatMoney } from "../Services/international";

/**
 * Display currency for international promoters. Prices are always charged in
 * ZAR; this only converts for "≈ $1,200" estimates.
 */

type FxRates = {
  base: "ZAR";
  rates: Record<string, number>;
  updatedAt: string | null;
  source: "live" | "fallback";
};

type CurrencyContextValue = {
  currency: string;
  setCurrency: (code: string) => void;
  /** Live (or fallback) rates loaded */
  ready: boolean;
  updatedAt: string | null;
  isLive: boolean;
  /** ZAR → display currency, or null when no rate is available */
  convert: (zar: number) => number | null;
  /** "≈ $720" for non-ZAR currencies, null for ZAR or unknown rates */
  estimate: (zar: number) => string | null;
};

const STORAGE_KEY = "otb_display_currency";
const SUPPORTED = new Set(CURRENCIES.map((c) => c.code));

function initialCurrency(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.has(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const detected = detectCountry()?.currency;
  return detected && SUPPORTED.has(detected) ? detected : "ZAR";
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState(initialCurrency);

  const { data } = useQuery({
    queryKey: ["fx"],
    queryFn: async () => (await api.get<FxRates>("/fx")).data,
    staleTime: 60 * 60 * 1000,
    enabled: currency !== "ZAR",
  });

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const rate = currency === "ZAR" ? 1 : data?.rates?.[currency];
    const convert = (zar: number) => (rate ? zar * rate : null);
    return {
      currency,
      setCurrency,
      ready: currency === "ZAR" || Boolean(data),
      updatedAt: data?.updatedAt || null,
      isLive: data?.source === "live",
      convert,
      estimate: (zar: number) => {
        if (currency === "ZAR") return null;
        const v = convert(zar);
        return v == null ? null : `≈ ${formatMoney(v, currency)}`;
      },
    };
  }, [currency, data, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
