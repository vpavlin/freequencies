# Roadmap

Four steps, in order (see [ADR 0001](adr/0001-architecture.md)). Every feature ships on both
Basecamp (desktop) and Android before it counts as done.

Legend: ✅ done · 🔨 in progress · ⬜ not started · 🧪 built, awaiting review/device test

## 1. Scala as the spine (in [vpavlin/scala](https://github.com/vpavlin/scala), branch `feat/frequencies-views`)

Already in Scala before this project: month/week/day views, text search, duplicate, drag to
move, custom fields with badges, RSVP, owner/editor/viewer and Closed/Open/Collaborative.

| Feature | Mobile | Desktop | Notes |
|---|---|---|---|
| Clash warnings (overlapping events in a calendar) | 🧪 | 🧪 | `d93cc4e`; tests in `mobile/test/clashes.test.mjs` |
| Filter by field value and date range | 🧪 | 🧪 | `33d17fd`; enum/yes-no fields, presets; tests in `mobile/test/filters.test.mjs`. Core `searchEvents` unchanged (title/description/location only) |
| Timeline with lanes (per calendar, or per enum field such as venue) | 🧪 | 🧪 | `2cdee83`; 14 days, "By calendar / By <field>"; tests in `mobile/test/lanes.test.mjs` |
| Comments per event (Scala ADR 0024, on ADR 0021 `ext` events) | 🧪 | 🧪 | both folds + parity fixtures; core `postExt`/`deleteExt`; Frequencies reads the same items |
| Poster thumbnails from image attachments | ⬜ | ⬜ | phones can fetch but not upload attachments yet |
| Desktop reminders follow each event's reminder setting | n/a | 🧪 | `66a5011`; the in-app banner used to fire 15 min before every event |
| Hardening: core reads other members' data with `json::value()` (throws on a wrong type) | 🧪 | 🧪 | fold: typed reads in both folds + malformed parity fixtures (`12a5276`); reminders `66a5011`; ~55 remaining calls in `scala_impl.cpp` to audit |
| Public "community" tier | ⬜ | ⬜ | needs a key-publishing design first |

**Test build:** desktop core `scala` 0.12.0 + view `scala_ui` 0.12.0 (includes the intents work from
`feat/intents`) and Android 0.9.117 contain the features above.

## 2. Link the modules we have

| Feature | Status | Notes |
|---|---|---|
| Kith: artists as contacts, with a `fee` field | ⬜ | |
| KYM: a budget per night, linked to the event id | ⬜ | |
| WhisperBox forms: artist booking requests, crew sign-up, guest lists → Scala events | ⬜ | design requested from the WhisperBox agent |

## 3. New modules

| Module | Status |
|---|---|
| Crew: roster, assignments, "I'm here" check-in | ⬜ |
| Gear: inventory, per-event checklist | ⬜ |
| Tasks: lists, deadlines (as Scala events), reminders | ⬜ |
| Availability polling | ⬜ |

## 4. Frequencies itself

| Feature | Status |
|---|---|
| Event page linking artists, crew, budget, tasks, gear | ⬜ |
| "Same artist booked twice" warnings | ⬜ |
| Analytics (events per month, attendance, revenue) | ⬜ |
| Integrations: tickets, weather, venue maps | ⬜ |
