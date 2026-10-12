# 0002. The desktop app is a view over the Scala core; Freequencies data rides in Scala

- Status: accepted
- Date: 2026-10-10

## Context

ADR 0001 makes Scala the spine and Freequencies the layer on top. The first app needs to read and
write club nights without forking Scala's calendar, its sync, or its permissions.

## Decision

1. **`freequencies_ui` is a Basecamp `ui_qml` view module that depends on the `scala` core** and calls
   it like Scala's own view does (async cross-module calls). No Freequencies core module yet: there is
   no Freequencies-only state that needs one.
2. **A night is an ordinary Scala event.** Freequencies data lives in Scala's own mechanisms:
   - the calendar's custom fields: `status` (Hold / Confirmed / Cancelled), `venue` (text),
     `type` (Club night / Concert / Residency / Other). "Use for Freequencies" adds them to an existing
     calendar's schema (owners/editors only). A calendar counts as a Freequencies calendar only when its
     `status` field is a choice field offering Hold, Confirmed and Cancelled; a calendar with its own
     `status` (or a `venue`/`type` of another kind) is left alone, and "Use for Freequencies" says why
     instead of adopting it;
   - comments are Scala's (ADR 0024 in the Scala repo: `ext` items, ns `scala`, kind `comment`), so
     one thread shows in both apps;
   - later Freequencies-only data (links to artists, crew, gear) goes in `ext` items with
     ns `xyz.freequencies`.
3. **Colour comes from the status field** (ADR 0001 §4), not from the calendar.
4. **Screens in 0.1:** the nights board (the Lanes prototype: days down the side, one column per venue,
   status or calendar), a night panel (status, venue, type, attendance, comments), a quick "new night"
   dialog, and the calendar list with "Use for Freequencies".
5. **Android comes next**, as its own app that embeds Scala's sync library and joins the same calendars
   (a separate ADR when it starts).

## Rejected

- **A Freequencies core with its own event log:** a second copy of every night, and a sync path to keep
  in step with Scala's, for no data that Scala can't already carry.
- **Driving Scala's view through app intents** (Scala ADR 0023): intents are for one-off actions, and a
  board needs the full event list with fields and comments.

## Consequences

- Scala replaces a whole event on every edit (last write wins per event). Freequencies builds each edit on
  a copy fetched right before saving (`getEvent`), so a title or time someone else changed since the
  board refreshed isn't reverted. Two edits saved within the same moment can still race; a per-field
  update in the Scala core would close that (not done).

- Freequencies needs the `scala` core 0.12.0+ (comments); with an older core the board works and posting
  a comment fails with a message.
- Everything a promoter does in Freequencies is visible in Scala, and the other way round.
- The field names (`status`, `venue`, `type`) and their values are now a contract between the two apps.
