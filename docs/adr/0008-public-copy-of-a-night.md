# 0008. A public copy of a night, kept in step automatically

- Status: accepted (proof of concept; may pivot)
- Date: 2026-10-11

## Context

Everyone in a Freequencies calendar sees everything: holds, fees, crew, comments. Attendees need
"what's on": the night, the time, the venue, the public line-up, the guest-list link, and nothing
else. Scala has no public, read-only tier yet (it needs a key-publishing design). A manual "publish"
button would leave the public copy stale whenever someone forgot to press it.

## Decision

1. **The public side is an ordinary Scala calendar**, separate from the crew calendar: Closed (only
   its owner and editors add or change events), shared by its join link with anyone. Attendees use it
   in Scala or Freequencies like any calendar. Organisers who publish must be its owner or editors.
   The night's "Make public" picker offers only Closed calendars the organiser owns or edits (so a
   night can't land in someone's "Family" calendar) and can create a new one; "Share with attendees"
   makes a viewer invite, "Invite an organiser" an editor invite.
2. **A night is public when it carries a `public` item**, an `ext` item on the night:
   ```jsonc
   { "ns": "xyz.freequencies", "kind": "public", "target": "<night id>",
     "id": "public:<night id>:<random>", "data": { "calendar": "<public calendar id>" } }
   ```
   Turning Public off deletes it. Each switch-on gets a fresh id (Scala keeps a deleted id deleted);
   if two are live, the earliest-created counts.
3. **The copy is derived, never edited by hand.** Its id is `pub-<night id>`, so every device writes
   the same event and two organisers can't create duplicates. Its content is a pure function of the
   night (`mobile/src/app/publish.ts`, mirrored in the desktop view):
   - title, start, end, all-day and recurrence as on the night; the `venue` field as the location;
   - a description built from the **confirmed** artists' names and set times, and the share link of
     any guest-list form on the night;
   - never: the night's own description (it holds internal notes), fees, crew, holds, comments,
     or forms other than the guest list.
   - A cancelled night, or one whose Public switch was turned off, keeps its copy but titled
     "Cancelled: …", so people who saw it learn it's off instead of it vanishing.
4. **Whichever organiser's Freequencies is open does the copying.** After every refresh it compares
   each published night's copy with what it should be and writes only the differences (Scala
   `putEvent` on desktop, `createEvent` with an explicit id on Android; both are upserts). Devices
   that compute the same copy from the same data write identical content, so they converge.
5. A Freequencies calendar's nights are only copied into a calendar that is not itself a Freequencies
   calendar (no `status` field), so crew data can't be published into another crew calendar.

## Consequences

- Needs Scala core 0.12.4 (`putEvent`) on desktop. Android already supports explicit ids.
- If no organiser has Freequencies open, the public copy lags until one does. An always-on hub could
  do the copying later.
- Editing the public copy directly is pointless: the next refresh puts it back.
- A public copy that an organiser without edit rights in the public calendar would need to change
  is left alone; the night shows "can't update the public copy" so they know to ask an editor.

## Rejected

- **A Publish button:** the copy goes stale whenever someone forgets.
- **Publishing from the crew calendar with a read-only role:** viewers would still see fees and crew.
- **Deleting the copy on unpublish:** deleted ids stay deleted in Scala, so republishing would fail,
  and attendees wouldn't learn the night is off.
