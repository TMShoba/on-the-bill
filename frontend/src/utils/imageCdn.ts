const MODE = (import.meta.env.VITE_IMAGE_CDN as string) || "local";
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD as string | undefined;
const IMGIX = import.meta.env.VITE_IMGIX_DOMAIN as string | undefined;

export type ImageSize = "card" | "full" | "thumb";

const SIZE_MAP: Record<ImageSize, { w: number; h?: number }> = {
  thumb: { w: 200, h: 200 },
  card: { w: 600, h: 750 },
  full: { w: 1200 },
};

export const ARTIST_IMAGE_SLUG: Record<string, string> = {
  "1": "tyla",
  "2": "maphorisa",
  "3": "master-kg",
  "4": "kabza",
  "5": "nomcebo",
  "6": "shimza",
  "7": "black-coffee",
  "8": "tyler-icu",
  "9": "nasty-c",
  "10": "sjava",
  "11": "kelvin-momo",
  "12": "mellow-sleazy",
  "13": "focalistic",
  "14": "uncle-waffles",
  "15": "makhadzi",
  "16": "young-stunna",
  "17": "boohle",
  "18": "nkosazana",
  "19": "blxckie",
  "20": "musa-keys",
  "21": "areece",
  "22": "dlala-thukzin",
  "23": "dbn-gogo",
  "24": "oscar-mbo",
  "25": "cassper",
  "26": "zee-nxumalo",
  "27": "tman-xpress",
  "28": "scotts-maphuma",
  "29": "shakes-les",
  "30": "major-league",
  "31": "young-stunna",
  "32": "makhadzi",
  "33": "big-zulu",
  "34": "mawhoo",
  "35": "sir-trill",
  "36": "mr-jazziq",
  "37": "scorpion-kings",
  "38": "sjava",
  "39": "zakwe",
  "40": "umsebenzi-wethu",
  "41": "leemckrazy",
  "42": "khanyisa",
  "43": "logo-ricky",
  "44": "dj-stokie",
  "45": "pabi-cooper",
  "zee nxumalo": "zee-nxumalo",
  "tman xpress": "tman-xpress",
  "scotts maphuma": "scotts-maphuma",
  "shakes & les": "shakes-les",
  "shakes and les": "shakes-les",
  "major league djz": "major-league",
  "major league": "major-league",
  "big zulu": "big-zulu",
  mawhoo: "mawhoo",
  "sir trill": "sir-trill",
  "mr jazziq": "mr-jazziq",
  "scorpion kings": "scorpion-kings",
  "scorpion-kings": "scorpion-kings",
  zakwe: "zakwe",
  "umsebenzi wethu": "umsebenzi-wethu",
  leemckrazy: "leemckrazy",
  "lee mckrazy": "leemckrazy",
  khanyisa: "khanyisa",
  "logo ricky": "logo-ricky",
  "dj stokie": "dj-stokie",
  "pabi cooper": "pabi-cooper",
  tyla: "tyla",
  maphorisa: "maphorisa",
  "dj maphorisa": "maphorisa",
  "master kg": "master-kg",
  "kabza de small": "kabza",
  "nomcebo zikode": "nomcebo",
  shimza: "shimza",
  "black coffee": "black-coffee",
  "tyler icu": "tyler-icu",
  "nasty c": "nasty-c",
  sjava: "sjava",
  "kelvin momo": "kelvin-momo",
  "mellow & sleazy": "mellow-sleazy",
  focalistic: "focalistic",
  "uncle waffles": "uncle-waffles",
  makhadzi: "makhadzi",
  "young stunna": "young-stunna",
  boohle: "boohle",
  "nkosazana daughter": "nkosazana",
  blxckie: "blxckie",
  "musa keys": "musa-keys",
  areece: "areece",
  "a-reece": "areece",
  "a reece": "areece",
  "dlala thukzin": "dlala-thukzin",
  "dlala-thukzin": "dlala-thukzin",
  "dbn gogo": "dbn-gogo",
  "dbn-gogo": "dbn-gogo",
  "oscar mbo": "oscar-mbo",
  "oscar-mbo": "oscar-mbo",
  cassper: "cassper",
  "cassper nyovest": "cassper",
};

function slugFor(key: string): string {
  const k = key.trim().toLowerCase();
  return ARTIST_IMAGE_SLUG[k] || ARTIST_IMAGE_SLUG[key] || "tyla";
}

export function artistImage(
  artistIdOrName: string,
  size: ImageSize = "card"
): string {
  const slug = slugFor(artistIdOrName);
  const { w, h } = SIZE_MAP[size];

  if (MODE === "cloudinary" && CLOUD) {
    const crop = h ? `c_fill,w_${w},h_${h}` : `c_limit,w_${w}`;
    return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,${crop}/thelineup/artists/${slug}`;
  }
  if (MODE === "imgix" && IMGIX) {
    const params = h
      ? `w=${w}&h=${h}&fit=crop&auto=format,compress`
      : `w=${w}&fit=max&auto=format,compress`;
    return `https://${IMGIX}/artists/${slug}.webp?${params}`;
  }
  if (size === "card" || size === "thumb") return `/artists/${slug}-card.webp`;
  return `/artists/${slug}.webp`;
}

export function resolveArtistImage(
  imageUrl: string | undefined,
  artistId: string,
  size: ImageSize = "card"
): string {
  if (imageUrl?.startsWith("http")) return imageUrl;
  // Prefer local relative path when it points at a real file under /artists/
  if (imageUrl?.startsWith("/artists/")) {
    const base = imageUrl.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    if (size === "card" || size === "thumb") {
      return `${base}-card.webp`;
    }
    // Prefer webp full if path was jpg
    if (imageUrl.endsWith(".jpg") || imageUrl.endsWith(".jpeg")) {
      return `${base}.webp`;
    }
    return imageUrl;
  }
  return artistImage(artistId, size);
}
