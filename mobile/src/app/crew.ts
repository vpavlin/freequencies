// The crew of a night (ADR 0007): crew slots (ns "xyz.frequencies", kind "crew") and check-ins
// (kind "checkin") stored as Scala ext items on the event.
// Pure; the desktop view (FrequenciesView.qml `crewOf`) mirrors it.

const NS = "xyz.frequencies";
export const KIND_CREW = "crew";
export const KIND_CHECKIN = "checkin";
export type CrewStatus = "asked" | "confirmed" | "cancelled";
export const CREW_STATUSES: CrewStatus[] = ["asked", "confirmed", "cancelled"];
export const ROLES = ["Door", "Bar", "Sound", "Lights", "Security", "Cloakroom", "Runner"];

export interface CrewSlot {
  id: string;
  author: string;
  name: string;      // "" = an open slot
  contact: string;   // Kith contact id, "" when typed in
  book: string;
  role: string;
  call: string;
  status: CrewStatus;
  checkedIn: { id: string; author: string; at: number } | null;
}

interface ExtItem { ns?: unknown; kind?: unknown; id?: unknown; author?: unknown; data?: unknown }
const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;

// A fresh id per check-in: Scala keeps a deleted ext id deleted, so "undo, then check in again" needs
// a new one. The slot is in the id so a check-in can't be filed under someone else's slot.
export const checkinPrefix = (slotId: string) => "checkin:" + slotId + ":";
export const checkinId = (slotId: string, nonce = Math.random().toString(36).slice(2, 10)) => checkinPrefix(slotId) + nonce;

// Other members write these items, so every field is read by type and anything malformed is skipped.
export function crewOf(ev: { ext?: unknown }): CrewSlot[] {
  const xs = Array.isArray(ev?.ext) ? (ev.ext as ExtItem[]) : [];
  const checkins = new Map<string, { id: string; author: string; at: number }>();
  for (const x of xs) {
    if (!x || x.ns !== NS || x.kind !== KIND_CHECKIN || !str(x.id)) continue;
    const d = obj(x.data);
    const slot = str(d.crew);
    if (!slot || !str(x.id).startsWith(checkinPrefix(slot))) continue;
    const at = typeof d.at === "number" && isFinite(d.at) ? d.at : 0;
    // Two people checking the same person in at once: the earliest counts.
    const prev = checkins.get(slot);
    if (!prev || at < prev.at || (at === prev.at && str(x.id) < prev.id)) checkins.set(slot, { id: str(x.id), author: str(x.author), at });
  }
  const out: CrewSlot[] = [];
  for (const x of xs) {
    if (!x || x.ns !== NS || x.kind !== KIND_CREW || !str(x.id)) continue;
    const d = obj(x.data);
    const name = str(d.name).trim(), role = str(d.role).trim();
    if (!name && !role) continue;
    const st = str(d.status) as CrewStatus;
    const id = str(x.id);
    out.push({
      id, author: str(x.author), name, contact: name ? str(d.contact) : "", book: name ? str(d.book) : "",
      role, call: str(d.call).trim(), status: CREW_STATUSES.includes(st) ? st : "asked",
      checkedIn: name ? checkins.get(id) || null : null,
    });
  }
  // By role, then call time, then name; open slots last within a role.
  return out.sort((a, b) =>
    (a.role || "￿").localeCompare(b.role || "￿") || (a.call || "￿").localeCompare(b.call || "￿")
    || (a.name ? 0 : 1) - (b.name ? 0 : 1) || a.name.localeCompare(b.name));
}

export interface CrewSummary { people: number; open: number; confirmed: number; here: number }

// For the board and the night header: who is on (not cancelled), open slots, confirmed, arrived.
export function crewSummary(slots: CrewSlot[]): CrewSummary {
  let people = 0, open = 0, confirmed = 0, here = 0;
  for (const c of slots) {
    if (c.status === "cancelled") continue;
    if (!c.name) { open++; continue; }
    people++;
    if (c.status === "confirmed") confirmed++;
    if (c.checkedIn) here++;
  }
  return { people, open, confirmed, here };
}

export function crewSummaryLabel(s: CrewSummary): string {
  const parts: string[] = [];
  if (s.people) parts.push(`${s.people} on`);
  if (s.open) parts.push(`${s.open} open`);
  if (s.here) parts.push(`${s.here} here`);
  return parts.join(" · ");
}
