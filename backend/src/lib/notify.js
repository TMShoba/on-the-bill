import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { renderEmail, sendEmail } from "./mailer.js";
import { renderContractPdf, renderReceiptPdf, formatRand } from "./pdf.js";
import { adminEmails } from "./admin.js";

/**
 * In-app notifications + matching emails. Every helper swallows its own errors —
 * a failed notification must never fail the booking / payment / message that
 * caused it. Emails go out in the background and respect each user's
 * email_notifications preference.
 */

const USER_COLUMNS = "id, name, email, email_notifications";

/** Users who act for a catalog artist (linked via users.artist_id, or unlinked artist users) */
export async function artistUsers(artistId) {
  if (!artistId) return [];
  return db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE role = 'artist' AND (artist_id = ? OR id = ?)`)
    .all(String(artistId), String(artistId));
}

/** The promoter who owns a booking: promoter_id, or the account matching client_email */
export async function promoterUsers(booking) {
  if (booking.promoter_id) {
    const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(booking.promoter_id);
    return row ? [row] : [];
  }
  if (!booking.client_email) return [];
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE LOWER(email) = LOWER(?)`).all(booking.client_email);
}

export async function artistUserIds(artistId) {
  return (await artistUsers(artistId)).map((u) => u.id);
}

export async function promoterUserIds(booking) {
  if (booking.promoter_id) return [booking.promoter_id];
  return (await promoterUsers(booking)).map((u) => u.id);
}

export async function pushNotification(userId, { type, title, body, href }) {
  const id = uuidv4();
  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, href, created_at, read_flag)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), 0)`
    )
    .run(id, userId, type, String(title).slice(0, 200), String(body || "").slice(0, 500), href || null);
  return id;
}

function uniqueUsers(users) {
  const seen = new Set();
  return users.filter((u) => u && !seen.has(u.id) && seen.add(u.id));
}

/** In-app notification for each user, plus an email to those who allow it */
async function notifyUsers(users, inApp, email) {
  for (const user of uniqueUsers(users)) {
    await pushNotification(user.id, inApp);
    if (email && user.email && user.email_notifications !== 0) {
      const build = typeof email === "function" ? email : () => email;
      // Fire-and-forget: the request shouldn't wait on SMTP
      Promise.resolve(build(user))
        .then((msg) => msg && sendEmail({ to: user.email, ...msg }))
        .catch((e) => console.error("notify email", e.message));
    }
  }
}

function safe(label, fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      console.error(`notify:${label}`, e.message);
    }
  };
}

function eventRows(booking) {
  return [
    ["Artist", booking.artist_name],
    ["Promoter", booking.promoter_name || booking.client_name],
    ["Venue", [booking.venue, booking.city].filter(Boolean).join(", ")],
    ["Date", `${booking.event_date}${booking.time ? ` at ${booking.time}` : ""}`],
    ["Fee", booking.fee ? formatRand(booking.fee).replace(".00", "") : ""],
  ];
}

export const notifyNewBookingRequest = safe("booking_request", async (booking) => {
  const promoter = booking.promoter_name || booking.client_name || "A promoter";
  const venue = booking.venue || "an event";
  const international = booking.event_country && booking.event_country !== "ZA";
  await notifyUsers(
    await artistUsers(booking.artist_id),
    {
      type: "booking_request",
      title: "New booking request",
      body: `${promoter} wants to book you for ${venue} on ${booking.event_date}.`,
      href: "/dashboard",
    },
    {
      subject: `New booking request from ${promoter}`,
      ...renderEmail({
        heading: "You have a new booking request",
        intro: `${promoter} wants to book you for ${venue}${international ? " (international booking)" : ""}. Review the details and accept or decline from your dashboard.`,
        rows: eventRows(booking),
        cta: { label: "Review request", path: "/dashboard" },
      }),
    }
  );
});

export const notifyBookingStatusChange = safe("booking_status", async (booking, status) => {
  const accepted = status === "confirmed";
  const venue = booking.venue || "your event";
  await notifyUsers(
    await promoterUsers(booking),
    {
      type: accepted ? "booking_accepted" : "booking_declined",
      title: accepted ? "Booking accepted" : "Booking declined",
      body: `${booking.artist_name} ${accepted ? "accepted" : "declined"} your request for ${venue} on ${booking.event_date}.`,
      href: "/dashboard",
    },
    async () => {
      if (!accepted) {
        return {
          subject: `${booking.artist_name} declined your booking request`,
          ...renderEmail({
            heading: "Your request was declined",
            intro: `${booking.artist_name} isn't able to take ${venue} on ${booking.event_date}. Browse other artists who are available.`,
            rows: eventRows(booking),
            cta: { label: "Browse artists", path: "/artists" },
          }),
        };
      }
      // Attach the frozen contract as a PDF
      const contract = await db.prepare("SELECT * FROM booking_contracts WHERE booking_id = ?").get(booking.id);
      const attachments = contract
        ? [
            {
              filename: `LineUp-contract-${booking.id.slice(0, 8)}.pdf`,
              content: await renderContractPdf({ bookingId: booking.id, text: contract.text, generatedAt: contract.generated_at }),
              contentType: "application/pdf",
            },
          ]
        : [];
      return {
        subject: `${booking.artist_name} accepted your booking`,
        attachments,
        ...renderEmail({
          heading: "Booking accepted 🎉",
          intro: `${booking.artist_name} accepted your request for ${venue}. Your booking contract is attached. Pay the deposit to secure the date.`,
          rows: eventRows(booking),
          cta: { label: "Pay deposit", path: "/dashboard" },
          note: "The attached contract was generated when the artist accepted and won't change.",
        }),
      };
    }
  );
});

export const notifyPaymentReceived = safe("payment", async (booking, receipt) => {
  const label = receipt.kind === "deposit" ? "Deposit" : "Payment";
  const amt = formatRand(receipt.amount);
  const venue = booking.venue || "your event";
  const deposit =
    receipt.kind === "full"
      ? await db.prepare("SELECT id FROM receipts WHERE booking_id = ? AND kind = 'deposit'").get(booking.id)
      : null;
  const pdf = await renderReceiptPdf({ receipt, booking, isBalance: Boolean(deposit) });
  const attachments = [
    { filename: `LineUp-receipt-${receipt.id.slice(0, 8)}.pdf`, content: pdf, contentType: "application/pdf" },
  ];
  const rows = [...eventRows(booking).slice(0, 4), ["Amount", amt], ["Receipt", receipt.id.slice(0, 8).toUpperCase()]];

  await notifyUsers(
    await artistUsers(booking.artist_id),
    {
      type: "booking_paid",
      title: `${label} received`,
      body: `${label} of ${amt} for ${venue} was marked paid.`,
      href: "/dashboard",
    },
    {
      subject: `${label} received for ${venue}`,
      attachments,
      ...renderEmail({
        heading: `${label} received`,
        intro: `A ${label.toLowerCase()} of ${amt} for ${venue} has been recorded. The receipt is attached.`,
        rows,
        cta: { label: "View booking", path: "/dashboard" },
      }),
    }
  );
  await notifyUsers(
    await promoterUsers(booking),
    {
      type: "booking_paid",
      title: `${label} confirmed`,
      body: `Your ${label.toLowerCase()} of ${amt} for ${venue} is on record. Receipt is in the booking.`,
      href: "/dashboard",
    },
    {
      subject: `Your receipt for ${booking.artist_name}`,
      attachments,
      ...renderEmail({
        heading: `${label} confirmed`,
        intro: `Thanks — your ${label.toLowerCase()} of ${amt} for ${booking.artist_name} at ${venue} is on record. Your receipt is attached.`,
        rows,
        cta: { label: "View booking", path: "/dashboard" },
      }),
    }
  );
});

/**
 * New message: in-app always; email only for the first unread message in a
 * 30-minute window so an active chat doesn't flood inboxes.
 */
export const notifyNewMessage = safe("message", async (conv, sender, preview) => {
  const senderIsArtist =
    sender.id === conv.artist_id || (sender.artistId && sender.artistId === conv.artist_id);
  let recipients;
  if (senderIsArtist) {
    const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(conv.promoter_id);
    recipients = row ? [row] : [];
  } else {
    recipients = await artistUsers(conv.artist_id);
  }
  recipients = recipients.filter((u) => u.id !== sender.id);

  for (const user of uniqueUsers(recipients)) {
    const recent = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM notifications
         WHERE user_id = ? AND type = 'message' AND read_flag = 0
           AND created_at > NOW() - INTERVAL '30 minutes'`
      )
      .get(user.id);
    const shouldEmail = Number(recent?.n || 0) === 0;
    await notifyUsers(
      [user],
      {
        type: "message",
        title: `Message from ${sender.name || "User"}`,
        body: String(preview || "").slice(0, 120),
        href: "/messages",
      },
      shouldEmail
        ? {
            subject: `New message from ${sender.name || "a LineUp user"}`,
            ...renderEmail({
              heading: `${sender.name || "Someone"} sent you a message`,
              intro: String(preview || "").slice(0, 300),
              cta: { label: "Reply", path: "/messages" },
            }),
          }
        : null
    );
  }
});

/** Verification submitted → every admin; decision → the artist */
export const notifyVerificationSubmitted = safe("verification_submitted", async (artistUser, legalName) => {
  const emails = adminEmails();
  if (!emails.length) return;
  const admins = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE LOWER(email) IN (${emails.map(() => "?").join(",")})`)
    .all(...emails);
  await notifyUsers(
    admins,
    {
      type: "system",
      title: "Verification to review",
      body: `${artistUser.name || legalName} submitted identity documents.`,
      href: "/admin/verifications",
    },
    {
      subject: `Verification to review: ${artistUser.name || legalName}`,
      ...renderEmail({
        heading: "New artist verification",
        intro: `${artistUser.name || "An artist"} submitted their ID document and selfie for review.`,
        rows: [["Legal name", legalName], ["Account", artistUser.email]],
        cta: { label: "Open review queue", path: "/admin/verifications" },
      }),
    }
  );
});

export const notifyVerificationDecision = safe("verification_decision", async (userId, status, reason) => {
  const user = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(userId);
  if (!user) return;
  const approved = status === "identity_verified" || status === "fully_verified";
  await notifyUsers(
    [user],
    {
      type: "system",
      title: approved ? "You're verified" : "Verification needs an update",
      body: approved
        ? "Your identity was approved. You can now accept bookings."
        : `Your verification was not approved: ${reason || "please resubmit"}.`,
      href: "/dashboard?tab=profile",
    },
    {
      subject: approved ? "You're verified on The LineUp" : "Your verification needs an update",
      ...renderEmail({
        heading: approved ? "Identity approved ✅" : "We couldn't verify you yet",
        intro: approved
          ? "Your identity has been checked by our team. You can now accept bookings and add banking details."
          : `Our team couldn't approve your submission: ${reason || "please check your documents and resubmit"}.`,
        cta: { label: approved ? "Go to dashboard" : "Resubmit documents", path: "/dashboard?tab=profile" },
      }),
    }
  );
});
