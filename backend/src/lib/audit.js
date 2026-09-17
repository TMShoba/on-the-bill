/**
 * Lightweight security audit log (stdout).
 * Avoid logging passwords, tokens, or full message bodies.
 */
export function audit(event, detail = {}) {
  const safe = { ...detail };
  delete safe.password;
  delete safe.token;
  delete safe.authorization;
  delete safe.SMTP_PASS;
  if (safe.email) {
    // partial redaction
    const e = String(safe.email);
    const at = e.indexOf("@");
    safe.email =
      at > 1 ? `${e[0]}***${e.slice(at)}` : "***";
  }
  console.info(
    `[audit] ${new Date().toISOString()} ${event}`,
    JSON.stringify(safe)
  );
}
