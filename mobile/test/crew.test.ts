import assert from "node:assert/strict";
import { crewOf, crewSummary, crewSummaryLabel, checkinId } from "../src/app/crew.ts";
import { doubleBookings } from "../src/app/lineup.ts";

const crew = (id: string, data: unknown, extra: object = {}) => ({ ns: "xyz.freequencies", kind: "crew", id, author: "a1", data, ...extra });
const checkin = (slot: string, extra: object = {}, at = 1000) => ({ ns: "xyz.freequencies", kind: "checkin", id: checkinId(slot), author: "door", data: { crew: slot, at }, ...extra });

// crewOf: typed reads, malformed skipped, open slots, sorted by role → call → named first → name
const ev = { ext: [
  crew("1", { name: "Jana", role: "Door", call: "21:30", status: "confirmed", contact: "k1", book: "b1" }),
  crew("2", { name: "", role: "Bar" }),                       // open slot
  crew("3", { name: "Petr", role: "Bar", call: 7, status: "nope" }),
  crew("4", { name: "  ", role: "" }),                        // nothing → skipped
  crew("5", "not an object"),
  crew("6", { name: "Eva", role: "Bar" }),
  crew("7", { name: "Ota", role: "Door", call: "20:00", status: "cancelled" }),
  checkin("1"),
  checkin("1", { author: "late" }, 2000),                    // a second, later check-in: the earliest counts
  checkin("2"),                                               // open slot can't be checked in
  { ns: "xyz.freequencies", kind: "checkin", id: "checkin:1:x", data: { crew: "6", at: 5 } },   // id names another slot
  checkin("gone"),                                            // slot no longer exists
  { ns: "xyz.freequencies", kind: "artist", id: "a", data: { name: "DJ" } },
  null,
] };
const cs = crewOf(ev);
assert.deepEqual(cs.map((c) => c.id), ["6", "3", "2", "7", "1"], "Bar before Door; no call sorts last; open slot after named");
const by = Object.fromEntries(cs.map((c) => [c.id, c]));
assert.equal(by["3"].call, "", "a non-string call is dropped");
assert.equal(by["3"].status, "asked", "an unknown status reads as asked");
assert.equal(by["1"].checkedIn?.author, "door");
assert.equal(by["1"].checkedIn?.at, 1000);
assert.equal(by["2"].checkedIn, null, "open slots have no check-in");
assert.equal(by["6"].checkedIn, null, "a check-in whose id names another slot is ignored");
assert.notEqual(checkinId("1"), checkinId("1"), "a fresh id each time (deleted ext ids stay deleted)");
assert.ok(checkinId("1").startsWith("checkin:1:"));
assert.equal(by["2"].contact, "");
assert.deepEqual(crewOf({}), []);
assert.deepEqual(crewOf({ ext: {} }), []);

const sum = crewSummary(cs);
assert.deepEqual(sum, { people: 3, open: 1, confirmed: 1, here: 1 }, "cancelled Ota doesn't count");
assert.equal(crewSummaryLabel(sum), "3 on · 1 open · 1 here");
assert.equal(crewSummaryLabel(crewSummary([])), "");

// doubleBookings covers crew: Jana (Kith k1) on the door and as an artist the same day elsewhere
const day = Date.UTC(2026, 9, 17, 20);
const nights = [
  { key: "n1", startTime: day, endTime: day + 6 * 3600e3, title: "One", ext: [crew("c1", { name: "Jana", role: "Door", contact: "k1" })] },
  { key: "n2", startTime: day + 3600e3, endTime: day + 5 * 3600e3, title: "Two",
    ext: [{ ns: "xyz.freequencies", kind: "artist", id: "a1", data: { name: "Jana K", contact: "k1" } }] },
  { key: "n3", startTime: day, endTime: day + 3600e3, title: "Three", ext: [crew("c2", { name: "", role: "Bar" }), crew("c3", { name: "Ota", role: "Bar", status: "cancelled" })] },
  { key: "n4", startTime: day, endTime: day + 3600e3, title: "Four", ext: [crew("c4", { name: "", role: "Bar" }), crew("c5", { name: "ota", role: "Door" })] },
];
const d = doubleBookings(nights);
assert.equal(d.get("n1")?.[0].other.title, "Two");
assert.equal(d.get("n2")?.[0].other.title, "One");
assert.equal(d.has("n3"), false, "open slots and cancelled crew never clash");
assert.equal(d.has("n4"), false);

console.log("CREW OK");
