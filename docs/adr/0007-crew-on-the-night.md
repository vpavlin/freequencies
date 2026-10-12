# 0007. The crew of a night: roles and call times on the night, people from Kith

- Status: accepted (built; scope vs ADR 0001 awaiting the owner's confirmation)
- Date: 2026-10-11

## Context

ROADMAP step 3 lists "Crew: roster, assignments, 'I'm here' check-in". A night needs people besides
the artists: door, bar, sound, lights, security. Organisers want to see who is on, in which role, when
they are due, which roles are still open, and on the night who has actually arrived. The same split as
for artists applies (ADR 0004): Kith owns *who* a person is; *what they do on a night* belongs to the
night.

## Decision

1. **A crew slot is a Scala `ext` item on the night**, like a booking:
   ```jsonc
   { "ns": "xyz.freequencies", "kind": "crew", "target": "<event id>", "id": "<stable id>",
     "data": { "name": "Jana",                     // snapshot; may be "" for an open slot
               "contact": "<kith contact id>", "book": "<kith book id>",   // optional
               "role": "Door",                     // free text; the app suggests common roles
               "call": "21:30",                    // optional, free text: when they are due
               "status": "asked" } }               // "asked" | "confirmed" | "cancelled"
   ```
   A slot with a role and no name is an **open slot** ("we still need a second bartender"). People come
   from any Kith book the organiser has (the artists' book or a separate "Crew" book) or are typed in.
2. **Check-in is a separate item, so anyone on the door can do it:**
   ```jsonc
   { "ns": "xyz.freequencies", "kind": "checkin", "target": "<event id>", "id": "checkin:<crew item id>:<random>",
     "data": { "crew": "<crew item id>", "at": 1760212800000 } }
   ```
   The id starts with the slot's id, so a check-in can't be filed under another slot. Each check-in gets a
   fresh random suffix because Scala keeps a deleted id deleted: "undo, then check in again" needs a new
   id. If two people check the same person in, the earliest `at` counts. Undo is deleting it (its author
   or an owner/editor). A check-in whose slot no longer exists, or is an open slot, is ignored.
3. **Same rules as bookings:** the member who added a slot edits it; that member or an owner/editor
   removes it. "Same person twice" warnings cover crew too: one person (same Kith contact or same name)
   on two overlapping or same-day nights, as artist or crew, is flagged on both.
4. The logic is in `mobile/src/app/crew.ts` (tested) and mirrored in the desktop view.

## Relation to ADR 0001

ADR 0001 (decision 2) plans crew as **its own module**, with its own log, permissions and Android
app. This ADR covers only the part that belongs to a night: who works it, in which role, and who has
arrived, which is the same kind of data as the line-up (ADR 0004). The people themselves already have
a module (Kith). A separate crew module would still make sense for what spans nights (availability,
a standing roster, hours worked); if one is built, the slots here link to it the way bookings link to
Kith, and this ADR is revisited. Until then this is a deliberate, smaller step than ADR 0001 planned,
**awaiting the owner's confirmation**.

## Rejected

- **Crew as a WhisperBox sign-up form only:** good for collecting volunteers (ADR 0005 keeps that), but
  answers are private to the form's creator, so the rest of the crew couldn't see the roster.
- **Check-in as a status on the slot:** only the slot's author could change it, not whoever is on the door.

## Consequences

- No change to Scala's or Kith's formats; two new `ext` kinds in our namespace.
- Older Freequencies versions ignore `crew` and `checkin` items.
