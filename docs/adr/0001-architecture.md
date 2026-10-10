# 0001. Frequencies is composed from modules, with Scala as the spine

- Status: accepted
- Date: 2026-10-10

## Context

Frequencies organises club nights: when and where they happen, who plays, who works, what it
costs, what gear goes where, what's left to do. The plan of 2026-09-22
([plan-2026-09-22.md](../plan-2026-09-22.md)) sorted every requirement into three places. A
survey of Scala on 2026-10-10 found that more of the calendar side already exists than the plan
assumed (week/day views, search, duplicate, drag to move, custom fields with badges, RSVP).

Our apps follow the Logos app charter: Basecamp and Android at parity, built on Loam
(transport, sync, identity), local-first, an append-only event log per shared space, sealed
with that space's key.

## Decision

1. **Anything that is an event on a shared timeline lives in Scala**, built in the Scala repo
   so every Scala user benefits: fields, files, recurrence, reminders, permissions, the general
   views, filters, clash warnings, comments. Frequencies does not fork or wrap Scala's calendar.
   The test is "would a general calendar want this?": a view that only makes sense for organising
   events, such as one column per venue (the Lanes view, moved out of Scala on 2026-10-10), belongs
   to Frequencies.
2. **A different kind of thing gets its own module**: people (Kith), money (KYM), forms
   (WhisperBox), and new modules for crew, gear and tasks. Each has its own log, permissions
   and Android app, and is useful outside Frequencies.
3. **Frequencies is the top layer**: it links those modules to an event by the event's id, adds
   the domain rules that need more than one module (for example "the same artist is booked
   twice"), the event-centred UI, and external integrations.
4. **Colour and status come from custom fields.** Scala keeps an event in its calendar's
   colour; Frequencies maps a field value (status, type, venue) to colour on its own side.
5. **Build order:** Scala extensions first, then links to the modules that exist, then the new
   modules, then the Frequencies layer ([ROADMAP](../ROADMAP.md)).
6. **This repo** holds the Frequencies app and the new modules. Scala, KYM, Kith, Qaku and
   WhisperBox changes go to their own repos.

## Rejected

- **One monolithic app** with its own calendar, contacts and budget: duplicates working modules
  and their sync, and nothing built would be reusable.
- **Per-event colour in Scala:** built and reverted in Scala 0.9.76–0.9.79; an event's calendar
  is its identity there, so colour-by-field belongs to Frequencies.

## Consequences

- Most early work lands in the Scala repo and is tracked in this repo's roadmap.
- Links between modules are by id, so a module can be used and synced without Frequencies, and
  a link to something the viewer can't see degrades to "not available" rather than an error.
- How Frequencies reads other modules (app-to-app intents per Scala ADR 0023, or direct module
  calls) is decided when step 2 starts, in its own ADR.
