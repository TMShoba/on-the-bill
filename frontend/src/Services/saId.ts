/**
 * Client-side SA ID number check for instant feedback while typing.
 * Mirrors backend/src/lib/saId.js — the server re-checks on submit.
 */
export type SaIdResult =
  | { valid: true; dateOfBirth: string; citizenship: "citizen" | "permanent_resident" | "refugee" }
  | { valid: false; reason: string };

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function validateSaId(input: string, now = new Date(), minAge = 18): SaIdResult {
  const id = input.replace(/\s+/g, "");
  if (!/^\d{13}$/.test(id)) return { valid: false, reason: "An SA ID number has exactly 13 digits." };
  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  const year = (yy > now.getFullYear() % 100 ? 1900 : 2000) + yy;
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  if (dob.getUTCFullYear() !== year || dob.getUTCMonth() !== mm - 1 || dob.getUTCDate() !== dd) {
    return { valid: false, reason: "The first six digits must be a real date of birth (YYMMDD)." };
  }
  if (!["0", "1", "2"].includes(id[10])) {
    return { valid: false, reason: "The 11th digit (citizenship) must be 0, 1 or 2." };
  }
  if (!luhnValid(id)) return { valid: false, reason: "That ID number fails its check digit. Please check for typos." };
  const age = Math.floor((now.getTime() - dob.getTime()) / (365.2425 * 24 * 3600 * 1000));
  if (age < minAge) return { valid: false, reason: `You must be ${minAge} or older.` };
  return {
    valid: true,
    dateOfBirth: dob.toISOString().slice(0, 10),
    citizenship: id[10] === "0" ? "citizen" : id[10] === "1" ? "permanent_resident" : "refugee",
  };
}
