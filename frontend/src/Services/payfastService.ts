import { getFeeBreakdown } from "./platformFees";
/**
 * PayFast (South Africa) payment gateway helpers.
 * Docs: https://developers.payfast.co.za/
 *
 * Demo / sandbox mode — no real merchant credentials required.
 * Production would use VITE_PAYFAST_MERCHANT_ID, MERCHANT_KEY, PASSPHRASE
 * and post to https://www.payfast.co.za/eng/process (live) or
 * https://sandbox.payfast.co.za/eng/process (sandbox).
 */

export type PaymentMethod = "card" | "manual";

export type PayFastPaymentInput = {
  amount: number;
  itemName: string;
  itemDescription?: string;
  email?: string;
  nameFirst?: string;
  nameLast?: string;
  returnUrl?: string;
  cancelUrl?: string;
  customStr1?: string;
  customStr2?: string;
};

const SANDBOX_PROCESS = "https://sandbox.payfast.co.za/eng/process";

/** Sandbox test credentials published by PayFast */
const SANDBOX_MERCHANT_ID = "10000100";
const SANDBOX_MERCHANT_KEY = "46f0cd694581a";

function env(name: string): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[name];
}

function merchantId() {
  return env("VITE_PAYFAST_MERCHANT_ID") || SANDBOX_MERCHANT_ID;
}

function merchantKey() {
  return env("VITE_PAYFAST_MERCHANT_KEY") || SANDBOX_MERCHANT_KEY;
}

function processUrl() {
  const live = env("VITE_PAYFAST_LIVE") === "true";
  return live
    ? "https://www.payfast.co.za/eng/process"
    : SANDBOX_PROCESS;
}

/**
 * Build the field map that would be POSTed to PayFast.
 * Signature is omitted in demo (sandbox often accepts without passphrase).
 */
export function buildPayFastFields(input: PayFastPaymentInput): Record<string, string> {
  const amount = Math.max(5, Number(input.amount) || 0).toFixed(2);
  const apiPublic =
    (import.meta.env.VITE_API_PUBLIC_URL as string | undefined)?.replace(/\/+$/, "") ||
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
    "";
  const fields: Record<string, string> = {
    merchant_id: merchantId(),
    merchant_key: merchantKey(),
    return_url:
      input.returnUrl ||
      `${window.location.origin}/dashboard?payment=success`,
    cancel_url:
      input.cancelUrl ||
      `${window.location.origin}/dashboard?payment=cancelled`,
    amount,
    item_name: input.itemName.slice(0, 100),
  };
  // ITN webhook — PayFast will POST payment result to the API
  if (apiPublic) {
    fields.notify_url = `${apiPublic}/api/payments/payfast/itn`;
  }
  // custom_str1 = booking id for ITN matching
  if (input.customStr1) {
    fields.m_payment_id = input.customStr1.slice(0, 100);
  }
  if (input.itemDescription)
    fields.item_description = input.itemDescription.slice(0, 255);
  if (input.email) fields.email_address = input.email;
  if (input.nameFirst) fields.name_first = input.nameFirst;
  if (input.nameLast) fields.name_last = input.nameLast;
  if (input.customStr1) fields.custom_str1 = input.customStr1;
  if (input.customStr2) fields.custom_str2 = input.customStr2;
  return fields;
}

/**
 * Redirect the browser to PayFast hosted checkout by POSTing a form.
 */
export function redirectToPayFast(input: PayFastPaymentInput) {
  const fields = buildPayFastFields(input);
  const form = document.createElement("form");
  form.method = "POST";
  form.action = processUrl();
  form.style.display = "none";
  for (const [k, v] of Object.entries(fields)) {
    const inputEl = document.createElement("input");
    inputEl.type = "hidden";
    inputEl.name = k;
    inputEl.value = v;
    form.appendChild(inputEl);
  }
  document.body.appendChild(form);
  form.submit();
}

/** Manual / EFT payment instructions (no gateway) */
export type ManualPaymentDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  reference: string;
  amount: number;
};

export function getManualPaymentDetails(
  amount: number,
  bookingRef: string
): ManualPaymentDetails {
  // Replace with your real business banking details before going live
  return {
    bankName: "Standard Bank",
    accountName: "The LineUp (Pty) Ltd",
    accountNumber: "UPDATE-WITH-REAL-ACCOUNT",
    branchCode: "051001",
    reference: bookingRef.slice(0, 20).toUpperCase(),
    amount,
  };
}


/** Amount to send to PayFast for deposit or full (includes platform fee) */
export function payfastAmountFor(
  performanceFee: number,
  kind: "deposit" | "full"
): { amount: number; breakdown: ReturnType<typeof getFeeBreakdown> } {
  const breakdown = getFeeBreakdown(performanceFee);
  return {
    amount: kind === "deposit" ? breakdown.depositTotal : breakdown.fullTotal,
    breakdown,
  };
}
