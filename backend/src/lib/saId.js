import crypto from "crypto";

/**
 * South African ID number checks (format YYMMDD SSSS C A Z):
 *  - 13 digits, real date of birth, citizenship digit 0/1/2, Luhn checksum.
 * This proves the number is well-formed — not that it belongs to the person.
 * Matching the ID to the person is the human review (ID document + selfie);
 * a Home Affairs lookup needs a KYC provider.
 */

function luhnValid(digits) {
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

export function validateSaId(input, { now = new Date(), minAge = 18 } = {}) {
  const id = String(input || "").replace(/\s+/g, "");
  if (!/^\d{13}$/.test(id)) return { valid: false, reason: "An SA ID number has exactly 13 digits." };

  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  // Two-digit year: anything later than this year belongs to the 1900s
  const century = yy > now.getFullYear() % 100 ? 1900 : 2000;
  const year = century + yy;
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  if (dob.getUTCFullYear() !== year || dob.getUTCMonth() !== mm - 1 || dob.getUTCDate() !== dd) {
    return { valid: false, reason: "The first six digits must be a real date of birth (YYMMDD)." };
  }

  const citizenship = id[10];
  if (!["0", "1", "2"].includes(citizenship)) {
    return { valid: false, reason: "The 11th digit (citizenship) must be 0, 1 or 2." };
  }
  if (!luhnValid(id)) return { valid: false, reason: "That ID number fails its check digit. Please check for typos." };

  const ageMs = now.getTime() - dob.getTime();
  const age = Math.floor(ageMs / (365.2425 * 24 * 3600 * 1000));
  if (age < minAge) return { valid: false, reason: `Artists must be ${minAge} or older to accept paid bookings.` };

  return {
    valid: true,
    id,
    dateOfBirth: dob.toISOString().slice(0, 10),
    citizenship: citizenship === "0" ? "citizen" : citizenship === "1" ? "permanent_resident" : "refugee",
    gender: Number(id.slice(6, 10)) >= 5000 ? "M" : "F",
    last4: id.slice(-4),
  };
}

/** Keyed hash so the stored value can't be brute-forced back into an ID without the server secret */
export function hashIdNumber(id) {
  const secret = process.env.ID_HASH_SECRET || process.env.JWT_SECRET || "dev-id-hash-secret";
  return crypto.createHmac("sha256", secret).update(String(id)).digest("hex");
}
