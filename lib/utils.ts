import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats an ISO timestamp (or Date) using the Gregorian calendar with Latin digits
 * in Arabic ("ar-u-ca-gregory-nu-latn") or "en-US".
 * Date-only "YYYY-MM-DD" strings are pinned to UTC so they never shift by a day.
 */
export function formatAdminDate(
  value: string | Date | null | undefined,
  locale: string,
  options: { includeTime?: boolean } = {}
): string {
  if (!value) return "—";

  const isDateOnly = typeof value === "string" && DATE_ONLY_PATTERN.test(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const intlLocale = locale === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-US";
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(options.includeTime && !isDateOnly
      ? { hour: "2-digit", minute: "2-digit" }
      : {}),
    ...(isDateOnly ? { timeZone: "UTC" } : {}),
  };

  return new Intl.DateTimeFormat(intlLocale, formatOptions).format(date);
}

/**
 * Computes a human-readable relative label (e.g. "Today", "3d ago", "منذ 3 أيام").
 */
export function formatRelativeActivity(
  value: string | Date | null | undefined,
  locale: string
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  const isAr = locale === "ar";
  if (diffMinutes < 5) return isAr ? "الآن" : "Just now";
  if (diffMinutes < 60) return isAr ? `منذ ${diffMinutes} دقيقة` : `${diffMinutes}m ago`;
  if (diffHours < 24) return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
  if (diffDays === 1) return isAr ? "أمس" : "Yesterday";
  if (diffDays < 30) return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return isAr ? `منذ ${diffMonths} شهر` : `${diffMonths}mo ago`;
}
