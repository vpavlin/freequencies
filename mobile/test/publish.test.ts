import assert from "node:assert/strict";
import { publicLinkOf, publicItemId, publicEventId, publicCopyOf, sameCopy, mirrorPlan, copyToEvent } from "../src/app/publish.ts";

const pub = (night: string, cal: unknown, wall: number, extra: object = {}) =>
  ({ ns: "xyz.freequencies", kind: "public", id: publicItemId(night), author: "a", hlc: { wall, ctr: 0, dev: "d" }, data: { calendar: cal }, ...extra });
const artist = (id: string, data: object) => ({ ns: "xyz.freequencies", kind: "artist", id, data });
const form = (purpose: string, uri: string) => ({ ns: "xyz.freequencies", kind: "form", id: "f-" + purpose, data: { formId: "x", uri, purpose } });

// publicLinkOf: earliest live item for THIS night; malformed ignored
assert.equal(publicLinkOf({ id: "n1", ext: [] }), null);
assert.equal(publicLinkOf({ id: "n1", ext: [pub("n1", 7, 1)] }), null, "non-string calendar");
assert.equal(publicLinkOf({ id: "n1", ext: [pub("n2", "P", 1)] }), null, "an item filed for another night");
assert.equal(publicLinkOf({ id: "n1", ext: [pub("n1", "P2", 5), pub("n1", "P1", 3), null] })?.calendar, "P1");
assert.notEqual(publicItemId("n1"), publicItemId("n1"));
assert.equal(publicEventId("n1"), "pub-n1");

// publicCopyOf: only public things
const night = {
  id: "n1", title: " Low End Theory ", startTime: 1000, endTime: 5000, description: "INTERNAL: licence pending",
  fields: { status: "Confirmed", venue: "Cross Club", fee: 99 },
  ext: [
    artist("a1", { name: "Mira Vex", set: "01:30–04:00", fee: 300, status: "confirmed" }),
    artist("a2", { name: "Hana Sun", set: "22:00–23:30", fee: 80, status: "confirmed" }),
    artist("a3", { name: "Maybe Guy", status: "asked" }),
    { ns: "xyz.freequencies", kind: "crew", id: "c1", data: { name: "Jana", role: "Door" } },
    { ns: "scala", kind: "comment", id: "k", data: { text: "secret" } },
    form("crew", "whisperbox://crew"),
    form("guestlist", "whisperbox://guests"),
  ],
};
const c = publicCopyOf(night, true);
assert.equal(c.title, "Low End Theory");
assert.equal(c.location, "Cross Club");
assert.equal(c.description, "Line-up:\n22:00–23:30  Hana Sun\n01:30–04:00  Mira Vex\n\nGuest list: whisperbox://guests");
for (const leak of ["INTERNAL", "300", "Maybe Guy", "Jana", "secret", "whisperbox://crew"]) assert.ok(!JSON.stringify(c).includes(leak), "leaked " + leak);
const off = publicCopyOf(night, false);
assert.equal(off.title, "Cancelled: Low End Theory");
assert.equal(off.description, "This night is off.");
assert.equal(publicCopyOf({ ...night, fields: { status: "Cancelled" } }, true).title, "Cancelled: Low End Theory");
assert.equal(publicCopyOf({ id: "n", startTime: 1, endTime: 2 }, true).title, "Untitled night");

// sameCopy ignores key order in recur and empty-vs-missing parts
const r = publicCopyOf({ ...night, recur: { freq: "weekly", interval: 1 } }, true);
assert.ok(sameCopy({ ...copyToEvent(r), recur: { interval: 1, freq: "weekly" } } as any, r));
assert.ok(!sameCopy(undefined, r));
assert.ok(sameCopy(copyToEvent(publicCopyOf({ id: "n", startTime: 1, endTime: 2 }, true)) as any, publicCopyOf({ id: "n", startTime: 1, endTime: 2 }, true)));
assert.deepEqual(Object.keys(copyToEvent(publicCopyOf({ id: "n", startTime: 1, endTime: 2 }, true))).sort(), ["endTime", "startTime", "title"]);

// mirrorPlan
const isTarget = (id: string) => id === "P" || id === "Q";
const n1 = { ...night, ext: [...night.ext, pub("n1", "P", 1)] };
let plan = mirrorPlan([n1], [], isTarget);
assert.deepEqual(plan.map((w) => [w.calendarId, w.id, w.copy.title]), [["P", "pub-n1", "Low End Theory"]], "first publish creates the copy");
const stored = { id: "pub-n1", calendarId: "P", ...copyToEvent(plan[0].copy) };
assert.deepEqual(mirrorPlan([n1], [stored], isTarget), [], "an up-to-date copy is left alone");
assert.equal(mirrorPlan([night], [stored], isTarget)[0].copy.title, "Cancelled: Low End Theory", "switch off → cancelled copy");
assert.deepEqual(mirrorPlan([{ ...night, ext: [pub("n1", "C", 1)] }], [], isTarget), [], "never into a non-target (e.g. a crew calendar)");
const moved = mirrorPlan([{ ...night, ext: [...night.ext, pub("n1", "Q", 1)] }], [stored], isTarget);
assert.deepEqual(moved.map((w) => [w.calendarId, w.copy.title]).sort(), [["P", "Cancelled: Low End Theory"], ["Q", "Low End Theory"]], "moved to another public calendar");
assert.deepEqual(mirrorPlan([night], [], isTarget), [], "never published → nothing");

console.log("PUBLISH OK");
