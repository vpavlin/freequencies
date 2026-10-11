// The public copy of a night (ADR 0008): a night with a live `public` item (ns "xyz.frequencies") is
// copied into an ordinary Scala calendar under the id `pub-<night id>`, with only what attendees may
// see. Pure, so every organiser's device computes the same copy; the desktop view
// (FrequenciesView.qml `publicCopyOf` / `mirrorPlan`) mirrors it.

import { lineupOf } from "./lineup.ts";

const NS = "xyz.frequencies";
export const KIND_PUBLIC = "public";

interface ExtItem { ns?: unknown; kind?: unknown; id?: unknown; author?: unknown; data?: unknown; hlc?: unknown }
const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;

export const publicEventId = (nightId: string) => "pub-" + nightId;
// A fresh id per switch-on: Scala keeps a deleted ext id deleted, so "off, then on again" needs a new one.
export const publicPrefix = (nightId: string) => "public:" + nightId + ":";
export const publicItemId = (nightId: string, nonce = Math.random().toString(36).slice(2, 10)) => publicPrefix(nightId) + nonce;

export interface PublicLink { id: string; author: string; calendar: string }

// The night's live Public switch: the earliest-created `public` item filed under this night.
export function publicLinkOf(ev: { id?: unknown; ext?: unknown }): PublicLink | null {
  const nightId = str(ev?.id);
  const xs = Array.isArray(ev?.ext) ? (ev.ext as ExtItem[]) : [];
  let best: (PublicLink & { wall: number; ctr: number }) | null = null;
  for (const x of xs) {
    if (!x || x.ns !== NS || x.kind !== KIND_PUBLIC || !nightId || !str(x.id).startsWith(publicPrefix(nightId))) continue;
    const calendar = str(obj(x.data).calendar);
    if (!calendar) continue;
    const h = obj(x.hlc);
    const wall = typeof h.wall === "number" ? h.wall : 0, ctr = typeof h.ctr === "number" ? h.ctr : 0;
    if (!best || wall < best.wall || (wall === best.wall && (ctr < best.ctr || (ctr === best.ctr && str(x.id) < best.id))))
      best = { id: str(x.id), author: str(x.author), calendar, wall, ctr };
  }
  return best ? { id: best.id, author: best.author, calendar: best.calendar } : null;
}

// Club nights run past midnight: a set starting before noon comes after the evening's sets. Doesn't
// depend on the device's timezone, so every device orders the line-up the same way. No time → last.
export function setKey(set: string): number {
  const m = /(\d{1,2})[:.](\d{2})/.exec(set || "");
  if (!m) return 1e6;
  const h = Number(m[1]), mi = Number(m[2]);
  return (h < 12 ? h + 24 : h) * 60 + mi;
}

export interface PublicCopy {
  title: string; startTime: number; endTime: number; allDay: boolean;
  location: string; description: string; recur: unknown;
}

export interface NightLike {
  id: string; title?: string; startTime: number; endTime: number; allDay?: boolean; recur?: unknown;
  fields?: Record<string, unknown>; ext?: unknown;
}

// Only what attendees may see. Never the night's own description (internal notes), fees, crew,
// holds, comments, or forms other than the guest list.
export function publicCopyOf(n: NightLike, published: boolean): PublicCopy {
  const f = obj(n.fields);
  const cancelled = !published || str(f.status) === "Cancelled";
  const lines: string[] = [];
  if (cancelled) lines.push("This night is off.");
  else {
    const acts = lineupOf(n).filter((b) => b.status === "confirmed").sort((a, b) => setKey(a.set) - setKey(b.set));
    if (acts.length) { lines.push("Line-up:"); for (const b of acts) lines.push(b.set ? `${b.set}  ${b.name}` : b.name); }
    const xs = Array.isArray(n.ext) ? (n.ext as ExtItem[]) : [];
    const guest = xs.find((x) => x && x.ns === NS && x.kind === "form" && str(obj(x.data).purpose) === "guestlist" && str(obj(x.data).uri));
    if (guest) { if (lines.length) lines.push(""); lines.push("Guest list: " + str(obj(guest.data).uri)); }
  }
  return {
    title: (cancelled ? "Cancelled: " : "") + (str(n.title).trim() || "Untitled night"),
    startTime: n.startTime, endTime: n.endTime, allDay: n.allDay === true,
    location: str(f.venue).trim(), description: lines.join("\n"), recur: n.recur ?? null,
  };
}

const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));

export function sameCopy(cur: Partial<PublicCopy> & { recur?: unknown } | undefined, want: PublicCopy): boolean {
  if (!cur) return false;
  return str(cur.title) === want.title && cur.startTime === want.startTime && cur.endTime === want.endTime
    && (cur.allDay === true) === want.allDay && str(cur.location) === want.location
    && str(cur.description) === want.description && canon(cur.recur ?? null) === canon(want.recur);
}

export interface MirrorWrite { calendarId: string; id: string; copy: PublicCopy; nightId: string }

// What to write so every published (or formerly published) night's copy is up to date.
// `nights` are the Frequencies calendars' events (masters, with ext); `all` is every event this device
// has; `isPublicTarget(calId)` says whether a calendar may receive copies (known here, not a Frequencies
// calendar). A night whose switch is off but whose copy exists gets the "Cancelled" copy.
export function mirrorPlan(nights: NightLike[], all: { id: string; calendarId: string }[], isPublicTarget: (calId: string) => boolean): MirrorWrite[] {
  const byId = new Map<string, { id: string; calendarId: string }[]>();
  for (const e of all) { const l = byId.get(e.id); if (l) l.push(e); else byId.set(e.id, [e]); }
  const out: MirrorWrite[] = [];
  for (const n of nights) {
    const pid = publicEventId(n.id);
    const link = publicLinkOf(n);
    const copies = (byId.get(pid) || []).filter((e) => isPublicTarget(e.calendarId));
    const targets = new Set(copies.map((e) => e.calendarId));
    if (link && isPublicTarget(link.calendar)) targets.add(link.calendar);
    for (const cal of targets) {
      const want = publicCopyOf(n, !!link && link.calendar === cal);
      const cur = copies.find((e) => e.calendarId === cal) as (Partial<PublicCopy> & { calendarId: string }) | undefined;
      if (!sameCopy(cur, want)) out.push({ calendarId: cal, id: pid, copy: want, nightId: n.id });
    }
  }
  return out;
}

// The event to store: a put replaces the whole event, so empty parts are simply left out.
export function copyToEvent(c: PublicCopy): Record<string, unknown> {
  const e: Record<string, unknown> = { title: c.title, startTime: c.startTime, endTime: c.endTime };
  if (c.allDay) e.allDay = true;
  if (c.location) e.location = c.location;
  if (c.description) e.description = c.description;
  if (c.recur != null) e.recur = c.recur;
  return e;
}
