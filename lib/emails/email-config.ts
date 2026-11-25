/**
 * Extracts the bare email address from a display-name formatted address
 * like "EduPlay <support@episodicstack.com>" -> "support@episodicstack.com".
 */
export function extractEmailAddress(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match ? match[1] : trimmed).trim();
}

/**
 * Returns the public-facing support/contact email address.
 * Prefers the verified Resend domain email so personal admin emails stay private.
 */
export function getPublicSupportEmail(): string {
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
  if (resendFrom) {
    return extractEmailAddress(resendFrom);
  }
  return process.env.EMAIL?.trim() || "";
}
