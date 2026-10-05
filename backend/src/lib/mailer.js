import nodemailer from "nodemailer";

/**
 * Outgoing email. Configure SMTP_HOST / SMTP_USER / SMTP_PASS (and SMTP_PORT,
 * SMTP_SECURE, SMTP_FROM). Without SMTP, emails are logged and skipped.
 * EMAIL_TEST_OUTBOX=true (non-production only) captures them in memory for tests.
 */

const SMTP_CONFIGURED = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
const TEST_OUTBOX = process.env.EMAIL_TEST_OUTBOX === "true" && process.env.NODE_ENV !== "production";

export const FROM_ADDRESS = process.env.SMTP_FROM || "The LineUp <no-reply@thelineup.co.za>";
export const APP_URL = (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");

const transporter = TEST_OUTBOX
  ? nodemailer.createTransport({ jsonTransport: true })
  : SMTP_CONFIGURED
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : null;

export const emailEnabled = Boolean(transporter);

/** Captured messages when EMAIL_TEST_OUTBOX=true */
export const testOutbox = [];

export async function sendEmail({ to, subject, text, html, attachments = [] }) {
  if (!to) return { sent: false, reason: "no recipient" };
  if (!transporter) {
    console.info(`[email:not-configured] Would send "${subject}"`);
    return { sent: false, reason: "SMTP not configured" };
  }
  // Summarise attachments before sending: the JSON test transport rewrites content in place
  const summary = attachments.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    size: a.content?.length || 0,
    isPdf: Buffer.isBuffer(a.content) && a.content.subarray(0, 5).toString() === "%PDF-",
  }));
  try {
    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, text, html, attachments });
    if (TEST_OUTBOX) testOutbox.push({ to, subject, text, attachments: summary });
    return { sent: true };
  } catch (e) {
    console.error("Email send failed:", e.message);
    return { sent: false, reason: e.message };
  }
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Branded, table-based email (renders in Gmail/Outlook).
 * rows: [label, value][] summary table; cta: { label, path }
 */
export function renderEmail({ heading, intro, rows = [], cta, note }) {
  const rowsHtml = rows
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:40%">${esc(k)}</td>` +
        `<td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">${esc(v)}</td></tr>`
    )
    .join("");
  const ctaHtml = cta
    ? `<a href="${esc(APP_URL + cta.path)}" style="display:inline-block;margin-top:24px;background:#10b981;color:#0f172a;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">${esc(cta.label)}</a>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="height:6px;background:#059669"></td></tr>
<tr><td style="padding:28px 28px 8px"><span style="font-size:20px;font-weight:800;color:#0f172a">The Line</span><span style="font-size:20px;font-weight:800;color:#059669">Up</span></td></tr>
<tr><td style="padding:8px 28px 28px">
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#0f172a">${esc(heading)}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#475569">${esc(intro)}</p>
${rowsHtml ? `<table role="presentation" width="100%" style="margin-top:18px;border-top:1px solid #e2e8f0;padding-top:8px">${rowsHtml}</table>` : ""}
${ctaHtml}
${note ? `<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#94a3b8">${esc(note)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;background:#f8fafc;font-size:12px;color:#94a3b8">You're receiving this because you have an account on The LineUp. Manage email preferences in Settings.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    heading,
    "",
    intro,
    "",
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    cta ? `\n${cta.label}: ${APP_URL}${cta.path}` : "",
    note ? `\n${note}` : "",
  ].join("\n");
  return { html, text };
}
