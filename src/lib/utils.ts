import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Join codes leave out every character that gets misread when someone reads a
 * code off one screen and types it into another. Excluded entirely: 0, 1, 5,
 * B, I, O, S, U and V — so no pair of glyphs in the alphabet is confusable.
 */
const CODE_ALPHABET = "ACDEFGHJKLMNPQRTWXYZ2346789";

export function generateJoinCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const chars = Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length] ?? "A",
  );
  return `${chars.slice(0, 3).join("")}-${chars.slice(3).join("")}`;
}

/**
 * Tidies what someone typed into the shape of a code: upper case, punctuation
 * dropped, grouped with a hyphen.
 *
 * It deliberately does not substitute lookalike characters. Both halves of
 * every confusable pair are absent from the alphabet, so an `O` or a `0` is
 * simply not part of any real code — silently rewriting one into the other
 * would turn an obvious typo into a code that looks plausible and can never
 * match.
 */
export function normaliseJoinCode(input: string): string {
  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return cleaned.length > 3
    ? `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    : cleaned;
}

export function generateChannelKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function relativeTime(date: Date, now = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: now.getFullYear() === date.getFullYear() ? undefined : "numeric",
  });
}

export function pluralise(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
