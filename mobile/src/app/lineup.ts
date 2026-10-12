// The line-up of a night (ADR 0004): artist bookings stored as Scala ext items
// (ns "xyz.freequencies", kind "artist") on the event, plus the "same artist booked twice" warning.
// Pure; the desktop view (FreequenciesView.qml `lineupOf` / `doubleBookings`) mirrors it.

import { crewOf } from "./crew.ts";

export const NS = "xyz.freequencies";
export const KIND_ARTIST = "artist";
export type BookingStatus = "asked" | "confirmed" | "cancelled";
export const STATUSES: BookingStatus[] = ["asked", "confirmed", "cancelled"];

export interface Booking {
  id: string;
  author: string;
  name: string;
  contact: string;   // Kith contact id, "" for a name-only artist
  book: string;      // Kith book id
  fee: number | null;
  currency: string;
  set: string;
  status: BookingStatus;
}

interface ExtItem { ns?: unknown; kind?: unknown; id?: unknown; author?: unknown; data?: unknown }
const str = (v: unknown) => (typeof v === "string" ? v : "");

// Other members write these items, so every field is read by type and anything malformed is skipped.
export function lineupOf(ev: { ext?: unknown }): Booking[] {
  const xs = Array.isArray(ev?.ext) ? (ev.ext as ExtItem[]) : [];
  const out: Booking[] = [];
  for (const x of xs) {
    if (!x || x.ns !== NS || x.kind !== KIND_ARTIST || !str(x.id)) continue;
    const d = (x.data && typeof x.data === "object" ? x.data : {}) as Record<string, unknown>;
    const name = str(d.name).trim();
    if (!name) continue;
    const fee = typeof d.fee === "number" && isFinite(d.fee) && d.fee >= 0 ? d.fee : null;
    const st = str(d.status) as BookingStatus;
    out.push({
      id: str(x.id), author: str(x.author), name, contact: str(d.contact), book: str(d.book), fee,
      currency: str(d.currency), set: str(d.set), status: STATUSES.includes(st) ? st : "asked",
    });
  }
  return out.sort((a, b) => (a.set || "￿").localeCompare(b.set || "￿") || a.name.localeCompare(b.name));
}

// One artist across nights: the Kith contact when there is one, else the name (case-insensitive).
export function artistKey(b: { contact: string; name: string }): string {
  return b.contact ? "c:" + b.contact : "n:" + b.name.trim().toLowerCase();
}

export function feeLabel(b: { fee: number | null; currency: string }): string {
  if (b.fee == null) return "";
  return b.currency ? `${b.fee} ${b.currency}` : String(b.fee);
}

export function totalFees(bs: Booking[]): { currency: string; total: number }[] {
  const m = new Map<string, number>();
  for (const b of bs) if (b.fee != null && b.status !== "cancelled") m.set(b.currency, (m.get(b.currency) || 0) + b.fee);
  return [...m.entries()].map(([currency, total]) => ({ currency, total }));
}

export interface Night { key: string; startTime: number; endTime: number; title: string; ext?: unknown }
export interface DoubleBooking { artist: string; other: Night }

const dayOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

// key → the clashes of its non-cancelled artists and crew with other nights: same person on a night that
// overlaps it or starts on the same day. Nights without a clash are absent.
export function doubleBookings(nights: Night[]): Map<string, DoubleBooking[]> {
  const byArtist = new Map<string, { night: Night; name: string }[]>();
  for (const n of nights) {
    const seen = new Set<string>();
    // Artists and named crew (ADR 0007): one person can't be in two places either way.
    const people = [...lineupOf(n), ...crewOf(n).filter((c) => c.name)];
    for (const b of people) {
      if (b.status === "cancelled") continue;
      const k = artistKey(b);
      if (seen.has(k)) continue;
      seen.add(k);
      const l = byArtist.get(k);
      if (l) l.push({ night: n, name: b.name }); else byArtist.set(k, [{ night: n, name: b.name }]);
    }
  }
  const out = new Map<string, DoubleBooking[]>();
  for (const list of byArtist.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i].night, b = list[j].night;
      if (a.key === b.key) continue;
      const overlap = a.startTime < b.endTime && b.startTime < a.endTime;
      if (!overlap && dayOf(a.startTime) !== dayOf(b.startTime)) continue;
      (out.get(a.key) || out.set(a.key, []).get(a.key)!).push({ artist: list[i].name, other: b });
      (out.get(b.key) || out.set(b.key, []).get(b.key)!).push({ artist: list[j].name, other: a });
    }
  }
  return out;
}
