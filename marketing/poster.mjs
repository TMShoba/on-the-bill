// Generates The LineUp share poster (SVG → PNG)
import { writeFileSync } from "fs";
import { Resvg } from "@resvg/resvg-js";

const OUT_DIR = process.argv[2] || ".";
const URL_TEXT = process.env.POSTER_URL || "on-the-bill.vercel.app";
const FONT_DIR =
  "C:/Users/ThaboS/OneDrive - SAICA/Desktop/Demo React Apps/On the Bill/backend/node_modules/@expo-google-fonts/noto-sans";

const W = 1080;
const H = 1350;

const G = {
  bright: "#6ee7b7",
  main: "#34d399",
  deep: "#10b981",
  dark: "#059669",
};

/**
 * One artist silhouette walking toward the viewer, drawn in a 100-unit tall
 * local space (head top = 0, front foot ~ 100). `stride` flips which leg/arm leads.
 * `paint` is the fill/stroke for this layer (rim, glow or body).
 */
function figureShapes(variant, stride, paint) {
  const m = stride === "left" ? 1 : -1; // mirror the gait
  // Mirror every x in a path string (numbers following M/L/C/Q pairs)
  const mx = (d) =>
    d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(Number(x) * m).toFixed(2)} ${y}`);
  const fillPath = (d) => `<path d="${mx(d)}" fill="${paint}"/>`;
  const limb = (d, w) =>
    `<path d="${mx(d)}" fill="none" stroke="${paint}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const dot = (x, y, r) => `<circle cx="${(x * m).toFixed(2)}" cy="${y}" r="${r}" fill="${paint}"/>`;
  const oval = (x, y, rx, ry) => `<ellipse cx="${(x * m).toFixed(2)}" cy="${y}" rx="${rx}" ry="${ry}" fill="${paint}"/>`;

  const parts = [];
  const sh = variant === "c" ? 9.4 : variant === "b" ? 10.8 : 10.2; // shoulder half-width

  // Head + neck
  parts.push(oval(0, 7, 4.8, 5.9));
  parts.push(fillPath("M -2 11.4 L 2 11.4 L 2.3 15.4 L -2.3 15.4 Z"));
  // Torso, shoulders curving into the waist and hips
  parts.push(
    fillPath(
      `M -2 14.6 C -5.5 14.8 ${-sh + 0.9} 15.2 ${-sh} 17.4 C ${-sh - 0.2} 21 -9 29 -8.2 38 ` +
        `C -8 43 -9 48 -9.4 52.2 L 9.4 52.2 C 9 48 8 43 8.2 38 C 9 29 ${sh + 0.2} 21 ${sh} 17.4 ` +
        `C ${sh - 0.9} 15.2 5.5 14.8 2 14.6 Z`
    )
  );
  // Leading leg: closer to the viewer, so longer and wider with a lower foot
  parts.push(
    fillPath(
      "M -9.9 50.5 C -10.4 61 -8.8 69 -8.6 76 C -8.4 84 -8.8 91 -8.6 96.6 L -3.3 96.6 " +
        "C -3.1 90 -2.5 82 -2.6 76 C -2.4 68 -0.3 59 -0.3 50.5 Z"
    )
  );
  parts.push(oval(-5.9, 98.1, 4.8, 2.3));
  // Trailing leg: further away, so shorter and narrower with a higher foot
  parts.push(
    fillPath(
      "M 0.3 50.5 C 0.5 59 2.5 67 2.8 73 C 3 80 3.3 87 3.5 91.2 L 8.1 91.2 " +
        "C 8.2 86 8.4 79 8.3 73 C 8.5 66 10 58 9.9 50.5 Z"
    )
  );
  parts.push(oval(5.8, 92.4, 3.6, 1.8));
  // Arms: the trailing-leg side swings forward (bent, foreshortened), the other swings back
  parts.push(limb(`M ${-sh + 0.4} 18.4 C ${-sh - 1.2} 24 ${-sh - 2} 31 ${-sh - 2.6} 37 C ${-sh - 2.9} 40 ${-sh - 2.9} 42 ${-sh - 2.7} 44`, 3.6));
  parts.push(dot(-sh - 2.6, 46, 2));
  parts.push(limb(`M ${sh - 0.4} 18.4 C ${sh + 1.6} 23 ${sh + 2} 28 ${sh + 1.4} 31.5 C ${sh + 0.4} 35 ${sh - 1.4} 37.4 ${sh - 2.6} 39`, 3.9));
  parts.push(dot(sh - 3, 40.6, 2.3));

  if (variant === "a") {
    // Bucket hat
    parts.push(oval(0, 3.3, 8, 1.6));
    parts.push(fillPath("M -5 3.5 C -5.4 -0.8 -3 -2.4 0 -2.4 C 3 -2.4 5.4 -0.8 5 3.5 Z"));
  }
  if (variant === "c") {
    // High bun + long open coat
    parts.push(oval(0, -1.4, 3.3, 3.1));
    parts.push(fillPath("M -9.8 49 C -10.8 55 -11.8 60 -12.3 64.5 Q 0 66.4 12.3 64.5 C 11.8 60 10.8 55 9.8 49 Z"));
  }
  return parts.join("");
}

/** Thin green line details that sit on top of the black silhouette */
function figureDetails(variant, stride) {
  const m = stride === "left" ? 1 : -1;
  const d = [];
  if (variant === "a") {
    // Hoodie strings + hat band
    d.push(`<path d="M -1.6 15.6 L -1.9 24 M 1.6 15.6 L 1.9 24" />`);
    d.push(`<path d="M -8 3.3 L 8 3.3" />`);
  }
  if (variant === "b") {
    // Open jacket + headphones around the neck
    d.push(`<path d="M ${-3 * m} 16 L ${-1.2 * m} 46 M ${3 * m} 16 L ${1.2 * m} 46" />`);
    d.push(`<path d="M -5.4 13.6 Q 0 18.6 5.4 13.6" />`);
    d.push(`<ellipse cx="-5.6" cy="14.2" rx="1.6" ry="2.2" />`);
    d.push(`<ellipse cx="5.6" cy="14.2" rx="1.6" ry="2.2" />`);
  }
  if (variant === "c") {
    // Coat lapels + hoop earrings
    d.push(`<path d="M -3.2 16 L -0.8 34 L -2.4 64 M 3.2 16 L 0.8 34 L 2.4 64" />`);
    d.push(`<circle cx="-4.9" cy="10" r="1.3" />`);
    d.push(`<circle cx="4.9" cy="10" r="1.3" />`);
  }
  return d.join("");
}

function figure({ id, x, footY, height, variant, stride, tilt = 0 }) {
  const s = height / 100;
  const place = `translate(${x} ${footY}) rotate(${tilt}) translate(0 ${-height}) scale(${s})`;
  const shapes = (paint) => figureShapes(variant, stride, paint);
  return `
  <g filter="url(#glow)" opacity="0.85"><g transform="${place}">${shapes(G.deep)}</g></g>
  <g filter="url(#rim)"><g transform="${place}">${shapes(G.main)}</g></g>
  <g transform="${place}">${shapes(`url(#body-${id})`)}</g>
  <g transform="${place}" fill="none" stroke="${G.main}" stroke-opacity="0.6" stroke-width="${(1.8 / s).toFixed(3)}" stroke-linecap="round">${figureDetails(variant, stride)}</g>`;
}

function bodyGradient(id) {
  return `<linearGradient id="body-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1a14"/>
      <stop offset="0.55" stop-color="#050807"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>`;
}

/** LineUp mark: three ascending bars, as in the app's BrandLogo */
function logoMark(x, y, size) {
  const s = size / 32;
  return `<g transform="translate(${x} ${y})">
    <rect width="${size}" height="${size}" rx="${size * 0.24}" fill="#04110b" stroke="${G.deep}" stroke-width="2.5"/>
    <g transform="scale(${s})">
      <rect x="6" y="20" width="20" height="3" rx="1.5" fill="${G.deep}"/>
      <rect x="6" y="14" width="14" height="3" rx="1.5" fill="${G.main}"/>
      <rect x="6" y="8" width="9" height="3" rx="1.5" fill="${G.bright}"/>
    </g>
  </g>`;
}

// Deterministic "dust" in the light beams
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const dust = Array.from({ length: 70 }, () => {
  const x = 140 + rand() * 800;
  const y = 120 + rand() * 640;
  const r = 0.8 + rand() * 1.8;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${G.bright}" opacity="${(0.15 + rand() * 0.45).toFixed(2)}"/>`;
}).join("");

const pills = [
  "Verified SA artists",
  "Book from anywhere",
  "PDF contracts &amp; receipts",
  "Secure deposits",
];

function pill(text, cx, cy) {
  const w = 372;
  const x0 = cx - w / 2;
  return `<g>
    <rect x="${x0}" y="${cy - 27}" width="${w}" height="54" rx="27" fill="#04110b" stroke="${G.dark}" stroke-width="2"/>
    <circle cx="${x0 + 32}" cy="${cy}" r="6" fill="${G.main}"/>
    <text x="${x0 + 54}" y="${cy + 8}" font-family="Noto Sans" font-weight="600" font-size="23" fill="${G.main}">${text}</text>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${["l", "c", "r"].map(bodyGradient).join("")}
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${G.deep}" stop-opacity="0.38"/>
      <stop offset="0.5" stop-color="${G.dark}" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="floor" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${G.main}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <filter id="rim" x="-20%" y="-20%" width="140%" height="140%">
      <feMorphology in="SourceGraphic" operator="dilate" radius="2.2" result="d"/>
      <feGaussianBlur in="d" stdDeviation="1"/>
    </filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="#000"/>

  <!-- Soft light behind the artists -->
  <ellipse cx="540" cy="520" rx="520" ry="420" fill="url(#halo)"/>
  <ellipse cx="540" cy="842" rx="360" ry="34" fill="url(#floor)"/>

  <!-- Three artists walking toward the viewer -->
  ${figure({ id: "l", x: 350, footY: 836, height: 600, variant: "a", stride: "right", tilt: -1 })}
  ${figure({ id: "r", x: 730, footY: 836, height: 590, variant: "c", stride: "left", tilt: 1 })}
  ${figure({ id: "c", x: 540, footY: 856, height: 660, variant: "b", stride: "left", tilt: -0.5 })}

  <!-- Logo + wordmark -->
  ${logoMark(186, 958, 96)}
  <text x="308" y="1040" font-family="Noto Sans" font-weight="900" font-size="108" letter-spacing="-3" fill="${G.main}">The Line<tspan fill="${G.bright}">Up</tspan></text>

  <text x="${W / 2}" y="1120" text-anchor="middle" font-family="Noto Sans" font-weight="600" font-size="36" fill="${G.deep}">Book South African artists, anywhere.</text>

  <text x="${W / 2}" y="1262" text-anchor="middle" font-family="Noto Sans" font-weight="600" font-size="30" letter-spacing="1" fill="${G.bright}">${URL_TEXT}</text>
</svg>`;

writeFileSync(`${OUT_DIR}/the-lineup-poster.svg`, svg);

const png = new Resvg(svg, {
  fitTo: { mode: "width", value: W * 2 },
  font: {
    loadSystemFonts: false,
    defaultFontFamily: "Noto Sans",
    fontFiles: [
      `${FONT_DIR}/400Regular/NotoSans_400Regular.ttf`,
      `${FONT_DIR}/600SemiBold/NotoSans_600SemiBold.ttf`,
      `${FONT_DIR}/900Black/NotoSans_900Black.ttf`,
    ],
  },
}).render().asPng();
writeFileSync(`${OUT_DIR}/the-lineup-poster.png`, png);
console.log("written", png.length, "bytes");
