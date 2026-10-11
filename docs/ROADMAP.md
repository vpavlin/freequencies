# Roadmap

Four steps, in order (see [ADR 0001](adr/0001-architecture.md)). Every feature ships on both
Basecamp (desktop) and Android before it counts as done.

Legend: ✅ done · 🔨 in progress · ⬜ not started · 🧪 built, awaiting review/device test

## 1. Scala as the spine (in [vpavlin/scala](https://github.com/vpavlin/scala), merged to `main`)

Already in Scala before this project: month/week/day views, text search, duplicate, drag to
move, custom fields with badges, RSVP, owner/editor/viewer and Closed/Open/Collaborative.

| Feature | Mobile | Desktop | Notes |
|---|---|---|---|
| Clash warnings (overlapping events in a calendar) | 🧪 | 🧪 | `d93cc4e`; tests in `mobile/test/clashes.test.mjs` |
| Filter by field value and date range | 🧪 | 🧪 | `33d17fd`; enum/yes-no fields, presets; tests in `mobile/test/filters.test.mjs`. Core `searchEvents` unchanged (title/description/location only) |
| Comments per event (Scala ADR 0024, on ADR 0021 `ext` events) | 🧪 | 🧪 | both folds + parity fixtures; core `postExt`/`deleteExt`; Frequencies reads the same items |
| Poster thumbnails from image attachments | ⬜ | ⬜ | phones can fetch but not upload attachments yet |
| Desktop reminders follow each event's reminder setting | n/a | 🧪 | `66a5011`; the in-app banner used to fire 15 min before every event |
| Hardening: core reads other members' data with `json::value()` (throws on a wrong type) | ✅ | ✅ | typed reads in both folds + malformed parity fixtures; every read in `scala_impl.cpp` converted (`scala` 0.12.2); malformed catch-up frames dropped (0.12.3) |
| Public "community" tier | ⬜ | ⬜ | needs a key-publishing design first |

**Released (2026-10-10):** desktop `scala` 0.12.2 + `scala_ui` 0.12.1 (Linux x86_64, Linux ARM64, macOS)
on apps.vpavlin.xyz and frequencies.vpavlin.xyz; Android 0.9.118 (vc139) on both F-Droid repos.
`scala` 0.12.3 (catch-up frame guard) is in testing.

## 2. Link the modules we have

| Feature | Status | Notes |
|---|---|---|
| Kith: artists from a Kith book; line-up, set times and fees per night (ADR 0004) | ✅ | fees live on the night, not on the contact; Android uses [kith-sdk](https://github.com/vpavlin/kith-sdk) |
| KYM: a budget per night, linked to the event id | ⬜ | design proposed in ADR 0006; needs budget-scoped calls in KYM |
| WhisperBox forms: artist booking requests, crew sign-up, guest lists, feedback (ADR 0005) | ✅ | desktop `frequencies_ui` 0.3.0 (needs `whisperbox_core` 0.4.2); Android 0.3.0 on whisperbox-sdk. Phone test of forms pending |

**Released (2026-10-10):** desktop `frequencies_ui` 0.3.0 (needs `scala` 0.12.2 + `kith` 0.3.2 + `whisperbox_core` 0.4.2)
and Android 0.3.0 (vc3) on [frequencies.vpavlin.xyz](https://frequencies.vpavlin.xyz). `frequencies_ui` 0.3.1 is in testing.

## 3. New modules

| Module | Status |
|---|---|
| Crew: roster, assignments, "I'm here" check-in | ⬜ |
| Gear: inventory, per-event checklist | ⬜ |
| Tasks: lists, deadlines (as Scala events), reminders | ⬜ |
| Availability polling | ⬜ |

## 4. Frequencies itself

| Feature | Status | Notes |
|---|---|---|
| Desktop app `frequencies_ui` (ADR 0002): nights board, night panel, new night, "Use for Frequencies" | ✅ | public, Linux x86_64/ARM64 and macOS |
| Nights board = the Lanes view (columns by venue / status / calendar) | ✅ | in `frequencies_ui`; logic from `prototypes/lanes` |
| Android app (ADR 0003): list board, night sheet, new night, calendars (create / join / Use for Frequencies) | ✅ | public F-Droid repo; arm64; needs the Loam app |
| Event page linking artists, crew, budget, tasks, gear | ⬜ | |
| "Same artist booked twice" warnings | ✅ | same Kith contact (or name) on overlapping or same-day nights; `mobile/src/app/lineup.ts` |
| Analytics (events per month, attendance, revenue) | ⬜ | |
| Integrations: tickets, weather, venue maps | ⬜ | |
