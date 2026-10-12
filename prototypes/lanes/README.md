# Lanes view (prototype)

Days down the side, one column per calendar or per value of a choice field (e.g. one column per
venue or per status). Built first as a Scala view, then moved here: it's an event organiser's view,
not something a general calendar needs (see ADR 0001).

- `lanes.ts`: pure logic (`buildLanes`, `laneOf`), no UI. Lane order: calendars in list order, or a
  field's values in schema order, then values only seen on events, then "—" for events without it.
- `lanes.test.mjs`: 10 cases (ordering, unknown values, a weekly residency, the 14-day window). It
  imports Scala's `recur.ts`; run it from a Scala checkout's `mobile/test` until Freequencies has its
  own app.
- `scala-lanes-view-2cdee83.patch`: the original Scala commit with the full mobile and desktop UI, to
  reuse when the Freequencies app gets its views.
