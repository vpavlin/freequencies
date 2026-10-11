# 0007. The crew of a night: roles and call times on the night, people from Kith

- Status: accepted
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
   { "ns": "xyz.frequencies", "kind": "crew", "target": "<event id>", "id": "<stable id>",
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
   { "ns": "xyz.frequencies", "kind": "checkin", "target": "<event id>", "id": "checkin:<crew item id>",
     "data": { "crew": "<crew item id>", "at": 1760212800000 } }
   ```
   The id is derived from the slot, so a slot has at most one check-in (the first author owns it). Undo
   is deleting it (its author or an owner/editor). A check-in whose slot no longer exists is ignored.
3. **Same rules as bookings:** the member who added a slot edits it; that member or an owner/editor
   removes it. "Same person twice" warnings cover crew too: one person (same Kith contact or same name)
   on two overlapping or same-day nights, as artist or crew, is flagged on both.
4. The logic is in `mobile/src/app/crew.ts` (tested) and mirrored in the desktop view.

## Rejected

- **Crew as a WhisperBox sign-up form only:** good for collecting volunteers (ADR 0005 keeps that), but
  answers are private to the form's creator, so the rest of the crew couldn't see the roster.
- **Check-in as a status on the slot:** only the slot's author could change it, not whoever is on the door.

## Consequences

- No change to Scala's or Kith's formats; two new `ext` kinds in our namespace.
- Older Frequencies versions ignore `crew` and `checkin` items.
