// src/parsers/utils/text.ts

export function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitLines(text: string): string[] {
  return normalizeWhitespace(text).split("\n").map(l => l.trim());
}

export function extractEmails(text: string): string[] {
  const re = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  return Array.from(new Set(text.match(re) ?? []));
}

export function extractPhones(text: string): string[] {
  // Very permissive; tune as needed
  const re = /(\+?\d{1,3}[\s-]?)?(\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g;
  const matches = text.match(re) ?? [];
  // filter out obviously short junk
  return Array.from(new Set(matches.map(m => m.trim()).filter(m => m.replace(/\D/g, "").length >= 10)));
}

export function extractUrls(text: string): string[] {
  const re = /\bhttps?:\/\/[^\s)]+/gi;
  return Array.from(new Set(text.match(re) ?? []));
}

export function scoreConfidence(base: number, clamp = true): number {
  const v = base;
  if (!clamp) return v;
  return Math.max(0, Math.min(1, v));
}