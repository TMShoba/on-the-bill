import fs from "fs";
import { createRequire } from "module";
import PDFDocument from "pdfkit";
import * as fontkit from "fontkit";

/**
 * Branded PDFs for booking contracts and payment receipts.
 *
 * Fonts: Noto Sans (Latin incl. South African diacritics, Greek, Cyrillic,
 * Vietnamese), with DejaVu Sans as a fallback for scripts Noto's build lacks
 * (Arabic, Hebrew, ...). Each text run uses one font, so a run containing
 * fallback-only characters is set entirely in DejaVu. Characters neither font
 * has (e.g. CJK) are dropped by safe().
 */

const require = createRequire(import.meta.url);
const FONT_FILES = {
  Regular: require.resolve("@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf"),
  Bold: require.resolve("@expo-google-fonts/noto-sans/700Bold/NotoSans_700Bold.ttf"),
  AltRegular: require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf"),
  AltBold: require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf"),
};
const FONT_DATA = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, fs.readFileSync(f)]));
const PRIMARY = fontkit.create(FONT_DATA.Regular);
const FALLBACK = fontkit.create(FONT_DATA.AltRegular);

const hasPrimary = (cp) => PRIMARY.hasGlyphForCodePoint(cp);
const hasFallback = (cp) => FALLBACK.hasGlyphForCodePoint(cp);

/** True when the text needs the fallback font for at least one character */
function needsFallback(text) {
  for (const ch of String(text || "")) {
    const cp = ch.codePointAt(0);
    if (!hasPrimary(cp) && hasFallback(cp)) return true;
  }
  return false;
}

/** Select the right face for this run of text; returns doc for chaining */
function setFont(doc, bold, text = "") {
  const alt = needsFallback(text);
  return doc.font(alt ? (bold ? "AltBold" : "AltRegular") : bold ? "Bold" : "Regular");
}

const INK = "#0f172a";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const RULE = "#e2e8f0";
const BRAND = "#059669";
const BRAND_SOFT = "#ecfdf5";

const PAGE = { size: "A4", margins: { top: 64, bottom: 56, left: 56, right: 56 } };
const LABEL_WIDTH = 170;

/** Drop characters no bundled font can draw (they'd render as empty boxes) */
export function safe(value) {
  let out = "";
  for (const ch of String(value ?? "")) {
    const cp = ch.codePointAt(0);
    if (ch === "\n" || hasPrimary(cp) || hasFallback(cp)) out += ch;
  }
  return out;
}

export function formatRand(amount) {
  const n = Number(amount) || 0;
  return `R${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  });
}

function toBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ...PAGE, bufferPages: true, info: build.info });
    for (const [name, data] of Object.entries(FONT_DATA)) doc.registerFont(name, data);
    doc.font("Regular");
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build.draw(doc);
      drawFooters(doc, build.footer);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function drawHeader(doc, docType, reference) {
  const { left } = doc.page.margins;
  const right = doc.page.width - doc.page.margins.right;
  doc.rect(0, 0, doc.page.width, 6).fill(BRAND);

  setFont(doc, true).fontSize(18).fillColor(INK).text("The Line", left, 30, { continued: true });
  doc.fillColor(BRAND).text("Up");

  setFont(doc, true).fontSize(8).fillColor(MUTED)
    .text(safe(docType).toUpperCase(), left, 32, { width: right - left, align: "right", characterSpacing: 1.2 });
  if (reference) {
    setFont(doc, false).fontSize(8).fillColor(FAINT)
      .text(`Ref ${safe(reference)}`, left, 44, { width: right - left, align: "right" });
  }
  doc.moveTo(left, 64).lineTo(right, 64).lineWidth(0.75).strokeColor(RULE).stroke();
  doc.x = left;
  doc.y = 84;
}

function drawFooters(doc, footerText) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const { left, right, bottom } = doc.page.margins;
    const y = doc.page.height - bottom + 24;
    const width = doc.page.width - left - right;
    // Writing inside the bottom margin must not trigger a new page
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.moveTo(left, y - 10).lineTo(left + width, y - 10).lineWidth(0.5).strokeColor(RULE).stroke();
    setFont(doc, false, footerText).fontSize(7.5).fillColor(FAINT)
      .text(safe(footerText), left, y, { width: width - 80, lineBreak: false });
    setFont(doc, false).text(`Page ${i - range.start + 1} of ${range.count}`, left, y, { width, align: "right", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
}

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function sectionHeading(doc, title) {
  ensureSpace(doc, 48);
  doc.moveDown(0.55);
  const { left } = doc.page.margins;
  setFont(doc, true, title).fontSize(8.5).fillColor(BRAND)
    .text(safe(title).toUpperCase(), left, doc.y, { characterSpacing: 1.1 });
  const y = doc.y + 4;
  doc.moveTo(left, y).lineTo(left + contentWidth(doc), y).lineWidth(0.5).strokeColor(RULE).stroke();
  doc.y = y + 6;
}

function keyValue(doc, label, value, { strong = false } = {}) {
  const { left } = doc.page.margins;
  const valueWidth = contentWidth(doc) - LABEL_WIDTH;
  const text = safe(value) || "-";
  // Row height is the taller of label and value (either can wrap)
  setFont(doc, strong, value).fontSize(9.5);
  const valueH = doc.heightOfString(text, { width: valueWidth });
  setFont(doc, false, label).fontSize(9);
  const labelH = doc.heightOfString(safe(label), { width: LABEL_WIDTH - 12 });
  const h = Math.max(valueH, labelH, 11);
  ensureSpace(doc, h + 6);
  const y = doc.y;
  setFont(doc, false, label).fontSize(9).fillColor(MUTED).text(safe(label), left, y, { width: LABEL_WIDTH - 12 });
  setFont(doc, strong, value).fontSize(9.5).fillColor(INK).text(text, left + LABEL_WIDTH, y, { width: valueWidth });
  doc.y = y + h + 1.5;
}

function paragraph(doc, text, { color = MUTED, size = 8.5 } = {}) {
  const { left } = doc.page.margins;
  setFont(doc, false, text).fontSize(size);
  ensureSpace(doc, doc.heightOfString(safe(text), { width: contentWidth(doc) }) + 4);
  doc.fillColor(color).text(safe(text), left, doc.y, { width: contentWidth(doc), lineGap: 1 });
  doc.moveDown(0.4);
}

/**
 * Parse the frozen plain-text contract into blocks. The text is the record of
 * what was agreed, so the PDF is a rendering of it — never regenerated data.
 */
export function parseContractText(text) {
  const lines = String(text || "").split(/\r?\n/);
  const blocks = [];
  const meta = {};
  let title = "";
  let para = null;

  const flush = () => {
    if (para) blocks.push({ type: "para", text: para.join(" ") });
    para = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!title && line.trim()) {
      title = line.trim();
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const indented = /^\s{2,}/.test(line);
    const trimmed = line.trim();
    const kv = /^([A-Za-z][A-Za-z0-9 ()/&'-]{0,48}):\s+(.+)$/.exec(trimmed);

    if (!indented && !blocks.length && kv && /^(Booking|Generated)$/i.test(kv[1])) {
      meta[kv[1].toLowerCase()] = kv[2];
      continue;
    }
    if (!indented && !blocks.length && /^Generated\s/.test(trimmed)) {
      meta.generated = trimmed.replace(/^Generated\s+/, "");
      continue;
    }
    if (!indented && /^[A-Z][A-Z0-9 ()&/,'-]+$/.test(trimmed) && trimmed.length < 60) {
      flush();
      blocks.push({ type: "heading", text: trimmed });
      continue;
    }
    if (indented && kv) {
      flush();
      blocks.push({ type: "kv", label: kv[1], value: kv[2] });
      continue;
    }
    para = para || [];
    para.push(trimmed);
  }
  flush();
  return { title, meta, blocks };
}

/** Contract PDF rendered from the stored (frozen) contract text */
export function renderContractPdf({ bookingId, text, generatedAt }) {
  const parsed = parseContractText(text);
  const reference = String(bookingId).slice(0, 8).toUpperCase();
  return toBuffer({
    info: { Title: `Booking confirmation ${reference}`, Author: "The LineUp", Subject: "Booking confirmation" },
    footer: `The LineUp · Booking confirmation · ${bookingId}`,
    draw(doc) {
      drawHeader(doc, "Booking confirmation", reference);
      setFont(doc, true).fontSize(20).fillColor(INK).text("Booking confirmation");
      doc.moveDown(0.25);
      setFont(doc, false).fontSize(9.5).fillColor(MUTED)
        .text(safe(`Booking ${parsed.meta.booking || bookingId}  ·  Confirmed ${formatDate(generatedAt) || parsed.meta.generated || ""}`));
      // Acceptance record
      const { left } = doc.page.margins;
      const width = contentWidth(doc);
      setFont(doc, false).fontSize(9);
      const note = safe(
        `Accepted electronically by the Artist${generatedAt ? ` on ${formatDate(generatedAt)}` : ""}. ` +
          "Unchanged since acceptance."
      );
      const h = doc.heightOfString(note, { width: width - 24 }) + 20;
      doc.y += 10;
      const boxY = doc.y;
      doc.roundedRect(left, boxY, width, h, 6).fill(BRAND_SOFT);
      doc.fillColor(BRAND).text(note, left + 12, boxY + 10, { width: width - 24 });
      doc.y = boxY + h;
      doc.moveDown(0.4);

      for (const block of parsed.blocks) {
        if (block.type === "heading") sectionHeading(doc, block.text);
        else if (block.type === "kv") {
          const strong = /deposit due|artist receives|total/i.test(block.label);
          keyValue(doc, block.label, block.value, { strong });
        } else paragraph(doc, block.text);
      }

    },
  });
}

const METHOD_LABEL = { payfast: "Card (PayFast)", eft: "Bank transfer (EFT)", manual: "Recorded payment" };

/** Receipt PDF for one payment step */
export function renderReceiptPdf({ receipt, booking, isBalance }) {
  const reference = String(receipt.id).slice(0, 8).toUpperCase();
  const kindLabel = receipt.kind === "deposit" ? "Deposit" : isBalance ? "Balance payment" : "Full payment";
  return toBuffer({
    info: { Title: `Receipt ${reference}`, Author: "The LineUp", Subject: "Payment receipt" },
    footer: `The LineUp · Payment receipt · ${receipt.id}`,
    draw(doc) {
      drawHeader(doc, "Payment receipt", reference);
      const { left } = doc.page.margins;
      const width = contentWidth(doc);

      setFont(doc, true).fontSize(22).fillColor(INK).text("Payment receipt");
      doc.moveDown(0.25);
      const subtitle = `${kindLabel} for ${booking?.artist_name || receipt.artist_name || "your booking"}`;
      setFont(doc, false, subtitle).fontSize(9.5).fillColor(MUTED).text(safe(subtitle));
      doc.moveDown(0.8);

      // Amount card
      const cardY = doc.y;
      doc.roundedRect(left, cardY, width, 74, 8).fill(BRAND_SOFT);
      setFont(doc, false).fontSize(8.5).fillColor(BRAND)
        .text("AMOUNT PAID", left + 16, cardY + 14, { characterSpacing: 1 });
      setFont(doc, true).fontSize(26).fillColor(INK).text(formatRand(receipt.amount), left + 16, cardY + 30);
      const status = String(receipt.status || "paid").toUpperCase();
      setFont(doc, true).fontSize(8.5);
      const pillW = doc.widthOfString(status) + 20;
      doc.roundedRect(left + width - pillW - 16, cardY + 14, pillW, 18, 9)
        .fill(receipt.status === "refunded" ? "#fef2f2" : "#d1fae5");
      doc.fillColor(receipt.status === "refunded" ? "#b91c1c" : BRAND)
        .text(status, left + width - pillW - 16, cardY + 19, { width: pillW, align: "center" });
      doc.y = cardY + 74;
      doc.x = left;

      sectionHeading(doc, "Payment details");
      keyValue(doc, "Receipt number", receipt.id);
      keyValue(doc, "Date paid", formatDate(receipt.paid_at || receipt.created_at));
      keyValue(doc, "Payment type", kindLabel);
      keyValue(doc, "Method", METHOD_LABEL[receipt.method] || receipt.method);
      keyValue(doc, "Currency", "South African Rand (ZAR)");

      sectionHeading(doc, "Booking");
      keyValue(doc, "Booking reference", receipt.booking_id);
      keyValue(doc, "Artist", booking?.artist_name || receipt.artist_name);
      keyValue(doc, "Promoter", `${receipt.promoter_name || ""}${receipt.promoter_email ? ` (${receipt.promoter_email})` : ""}`);
      if (booking) {
        keyValue(doc, "Event", [booking.venue, booking.city].filter(Boolean).join(", ") || "TBC");
        keyValue(doc, "Event date", `${booking.event_date}${booking.time ? ` at ${booking.time}` : ""}`);
      }

      sectionHeading(doc, "Breakdown");
      keyValue(doc, "Towards artist fee", formatRand(receipt.artist_payout));
      keyValue(doc, "Platform fee", formatRand(receipt.platform_fee));
      keyValue(doc, "Total paid", formatRand(receipt.amount), { strong: true });

      doc.moveDown(1);
      paragraph(
        doc,
        "The artist receives the full agreed performance fee; the platform fee is paid by the promoter. " +
          "The LineUp facilitates the booking and is not a party to the performance agreement.",
        { color: FAINT, size: 8.5 }
      );
    },
  });
}
