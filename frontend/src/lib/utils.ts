/** Tiny className merger (no clsx/tailwind-merge required). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
