import assert from "node:assert/strict";
import { lineupOf, doubleBookings, totalFees, feeLabel, artistKey } from "../src/app/lineup.ts";

const item = (id: string, data: unknown, extra: object = {}) => ({ ns: "xyz.frequencies", kind: "artist", id, author: "a1", data, ...extra });

// lineupOf: typed reads, malformed skipped, sorted by set then name
const ev = { ext: [
  item("1", { name: "Zed", set: "01:00", fee: 300, currency: "EUR", status: "confirmed" }),
  item("2", { name: "Ann", set: "23:00", fee: "lots", status: "weird", contact: 5 }),
  item("3", { name: "  " }),
  item("4", "not an object"),
  { ns: "scala", kind: "comment", id: "c", data: { text: "hi" } },
  item("5", { name: "Bob" }),
  null,
] };
const lu = lineupOf(ev);
assert.deepEqual(lu.map((b) => b.name), ["Zed", "Ann", "Bob"], "01:00 < 23:00 as text; no set last");
assert.equal(lu[1].fee, null, "a non-number fee is dropped");
assert.equal(lu[1].status, "asked", "an unknown status reads as asked");
assert.equal(lu[1].contact, "", "a non-string contact is dropped");
assert.deepEqual(lineupOf({}), []);
assert.deepEqual(lineupOf({ ext: "x" }), []);

assert.equal(feeLabel(lu[0]), "300 EUR");
assert.equal(feeLabel(lu[1]), "");
assert.deepEqual(totalFees([...lu, { ...lu[0], id: "9", status: "cancelled" }]), [{ currency: "EUR", total: 300 }]);
assert.equal(artistKey({ contact: "", name: " DJ X " }), "n:dj x");
assert.equal(artistKey({ contact: "k1", name: "DJ X" }), "c:k1");

// doubleBookings
const H = 3600e3, d0 = new Date(2026, 9, 10, 20).getTime();
const night = (key: string, start: number, hours: number, ext: unknown[]) => ({ key, startTime: start, endTime: start + hours * H, title: key, ext });
const nights = [
  night("A", d0, 6, [item("a", { name: "DJ X", contact: "k1" })]),
  night("B", d0 + 2 * H, 2, [item("b", { name: "dj x (renamed)", contact: "k1" })]),            // overlaps A, same contact
  night("C", d0 + 24 * H, 4, [item("c", { name: "DJ X", contact: "k1" })]),                      // next day: fine
  night("D", d0 - 6 * H, 2, [item("d", { name: "Solo" })]),                                       // same day as E, no overlap
  night("E", d0 + 1 * H, 1, [item("e", { name: "solo" }), item("e2", { name: "Gone", status: "cancelled" })]),
  night("F", d0, 3, [item("f", { name: "Gone" })]),
];
const db = doubleBookings(nights);
assert.deepEqual([...db.keys()].sort(), ["A", "B", "D", "E"]);
assert.deepEqual(db.get("A")!.map((x) => x.other.key), ["B"]);
assert.deepEqual(db.get("E")!.map((x) => x.other.key), ["D"], "same name, same day; cancelled 'Gone' ignored");
assert.equal(db.has("F"), false);
assert.equal(db.has("C"), false);
console.log("LINEUP OK");
