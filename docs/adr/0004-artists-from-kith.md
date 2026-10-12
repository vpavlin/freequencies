# 0004. Artists come from Kith; the line-up and fees live on the night

- Status: accepted
- Date: 2026-10-10

## Context

ROADMAP step 2 links people to nights: "Kith: artists as contacts, with a `fee` field". Kith's own rule
(Kith ADR 0007) is that Kith owns *who* a person is and apps own *what* they do with them. A fee is not a
property of a person: the same DJ plays for different money at different nights. A line-up slot is also
a property of the night.

## Decision

1. **Artists are Kith contacts.** The crew keeps a shared Kith book (by convention named "Artists") with
   the artists' contact details. Freequencies reads it: on desktop through the `kith` core module
   (`searchContacts`, `getContact`), on Android through
   [kith-sdk](https://github.com/vpavlin/kith-sdk) (Kith ADR 0011), joined with the book's Kith invite
   link. Freequencies never writes to Kith contacts, and adds no fields to them.
2. **A booking is a Scala `ext` item on the night** (Scala ADR 0021):
   ```jsonc
   { "ns": "xyz.freequencies", "kind": "artist", "target": "<event id>", "id": "<stable id>",
     "data": { "name": "DJ Example",          // snapshot, shown even without Kith
               "contact": "<kith contact id>", "book": "<kith book id>",   // optional
               "fee": 250, "currency": "EUR",  // optional
               "set": "23:00–01:00",           // optional, free text
               "status": "asked" } }           // "asked" | "confirmed" | "cancelled"
   ```
   An artist without a Kith contact (just a name) is allowed, so the line-up works before anyone sets
   up Kith.
3. **Who can change it** follows Scala's rules for `ext` items: the member who added a booking changes
   it by posting the same `id` again; that member or a calendar owner/editor removes it. Another
   organiser who wants a different fee removes the booking and adds it again.
4. **Fees are visible to every member of the calendar.** Keep nights with fees in a calendar shared only
   with the crew; the public line-up belongs in the event description.
5. **"Same artist booked twice"**: a warning on both nights when one artist (same Kith contact, or same
   name when there is no contact) has a non-cancelled booking on two nights that overlap or fall on the
   same day. The rule lives in `mobile/src/app/lineup.ts` (tested) and is mirrored in the desktop view.
6. Without the `kith` module (desktop) or a joined Kith book (Android), the picker is replaced by a
   name field and a note on how to add Kith.

## Rejected

- **A `fee` field on Kith contacts:** puts booking data into everyone's address book and gives one fee
  per person, not per night.
- **Fees as Scala custom fields on the event:** one value per night, not per artist.

## Consequences

- No change to Kith's or Scala's data format; Freequencies reads both and writes only its own `ext` items.
- Renaming a contact in Kith doesn't rename old bookings (they keep the snapshot); the view shows the
  current Kith name when the contact is available.
- Android needs a second engine in the app (kith-sdk next to scala-sdk) sharing one loam-transport.
