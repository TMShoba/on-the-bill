/** Artist identity + claim verification (stored on the API). */
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type ClaimType = "self" | "manager" | "";

export type VerificationStatus =
  | "unverified"
  | "pending_review"
  | "identity_verified"
  | "fully_verified"
  | "rejected";

export type VerificationRecord = {
  userId: string;
  /** Links to the public artist profile id when known */
  artistProfileId?: string;
  claimType: ClaimType;
  legalName: string;
  idNumberLast4: string;
  hasIdDocument: boolean;
  hasSelfie: boolean;
  /** Manager-only */
  authorityNote: string;
  socialProofUrl: string;
  status: VerificationStatus;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

export type VerificationInput = {
  claimType: ClaimType;
  legalName: string;
  /** Full 13-digit SA ID — sent once over HTTPS; the server keeps only the last 4 + a hash */
  idNumber: string;
  /** data: URLs; optional when resubmitting with documents already on file */
  idDocument?: string;
  selfie?: string;
  authorityNote?: string;
  socialProofUrl?: string;
};

export function verificationQueryKey(userId: string | undefined) {
  return ["verification", userId] as const;
}

export async function fetchMyVerification(): Promise<VerificationRecord> {
  const { data } = await api.get<VerificationRecord>("/verification/me");
  return data;
}

/** Submit details; the server reviews them and returns the updated record. */
export async function submitVerification(
  input: VerificationInput
): Promise<VerificationRecord> {
  const { data } = await api.post<VerificationRecord>("/verification", input, { timeout: 90000 });
  return data;
}

/** Demo environments only (server rejects when ALLOW_DEMO_TOKENS is off). */
export async function demoApproveFully(): Promise<VerificationRecord> {
  const { data } = await api.post<VerificationRecord>("/verification/demo-approve");
  return data;
}

/** The signed-in artist's own verification record. */
export function useMyVerification(userId: string | undefined) {
  return useQuery({
    queryKey: verificationQueryKey(userId),
    queryFn: fetchMyVerification,
    enabled: Boolean(userId),
  });
}

export function isIdentityVerifiedStatus(status: VerificationStatus | undefined): boolean {
  return status === "identity_verified" || status === "fully_verified";
}

export function verificationLabel(status: VerificationStatus): string {
  switch (status) {
    case "fully_verified":
      return "Verified artist";
    case "identity_verified":
      return "Identity verified";
    case "pending_review":
      return "Verification pending";
    case "rejected":
      return "Verification needs update";
    default:
      return "Not verified";
  }
}

/* ------------------------------ Admin review ------------------------------ */

export type ReviewItem = VerificationRecord & {
  dateOfBirth?: string;
  reviewNotes?: string;
  reviewedBy?: string;
  accountName: string;
  accountEmail: string;
  stageName?: string;
};

export type ReviewDecision = "approve_identity" | "approve_full" | "reject";

export async function fetchReviewQueue(
  status: "pending_review" | "identity_verified" | "fully_verified" | "rejected"
): Promise<ReviewItem[]> {
  const { data } = await api.get<ReviewItem[]>("/verification/admin/queue", { params: { status } });
  return Array.isArray(data) ? data : [];
}

/** Object URL for a submitted document (revoke it when done) */
export async function fetchReviewFile(userId: string, kind: "id" | "selfie"): Promise<{ url: string; type: string }> {
  const { data } = await api.get<Blob>(
    `/verification/admin/${encodeURIComponent(userId)}/files/${kind}`,
    { responseType: "blob", timeout: 60000 }
  );
  return { url: URL.createObjectURL(data), type: data.type };
}

export async function decideVerification(
  userId: string,
  decision: ReviewDecision,
  reason?: string
): Promise<ReviewItem> {
  const { data } = await api.post<ReviewItem>(
    `/verification/admin/${encodeURIComponent(userId)}/decision`,
    { decision, reason }
  );
  return data;
}
