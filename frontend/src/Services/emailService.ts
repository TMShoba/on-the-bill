import { api } from "./api";

/**
 * Sends transactional email via the backend.
 * Credentials never leave the server (SMTP is configured only on the API).
 *
 * Backend route: POST /api/notifications/email
 * Body: { to, subject?, template, data }
 */

export type EmailTemplate =
  | "booking_request"
  | "booking_accepted"
  | "booking_declined"
  | "payment_received";

export type SendEmailInput = {
  to: string;
  subject?: string;
  template: EmailTemplate;
  data: Record<string, string | number>;
};

export async function sendTransactionalEmail(
  input: SendEmailInput
): Promise<boolean> {
  if (!input.to) {
    console.info(
      `[emailService] Skipped "${input.template}" — no recipient email.`
    );
    return false;
  }
  try {
    // api baseURL already ends with /api — do not prefix /api again
    await api.post("/notifications/email", input);
    return true;
  } catch (err) {
    console.info(
      `[emailService] Could not send "${input.template}" to ${input.to}.`,
      err
    );
    return false;
  }
}
