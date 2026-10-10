# 0005. Booking, crew and guest-list forms come from WhisperBox, attached to the night

- Status: accepted
- Date: 2026-10-10

## Context

ROADMAP step 2: artist booking requests, crew sign-up, guest lists and feedback are forms that people
outside the crew answer. WhisperBox already does encrypted forms on Logos: anyone with the link answers,
only the form's creator (and co-owners) can read the answers. Frequencies needs to tie a form to a night
and show the organiser what came in.

## Decision

1. **Forms are ordinary WhisperBox forms.** Frequencies creates them through WhisperBox and people
   answer them with the stock WhisperBox app. Desktop: the `whisperbox_core` module (`createForm`,
   `shareUri`, `snapshot`, `getDecryptedResponses`, `closeForm`). Android: whisperbox-sdk (WhisperBox
   ADR 0018), next to scala-sdk and kith-sdk on the one shared transport.
2. **The link to a night is a Scala `ext` item** (Scala ADR 0021):
   ```jsonc
   { "ns": "xyz.frequencies", "kind": "form", "target": "<event id>", "id": "<form id>",
     "data": { "formId": "<form id>", "uri": "whisperbox://form?id=…&by=0x…",
               "purpose": "booking" | "crew" | "guestlist" | "feedback", "title": "…" } }
   ```
   The `uri` is meant to be shared, so calendar members seeing it is fine. Removing the item detaches
   the form from the night; it does not close the form.
3. **Templates.** "Add a form" offers four starting points (artist booking, crew sign-up, guest list,
   feedback) with the night's name and date in the title. They live in the view for now and move to
   whisperbox-sdk's shared `templates` when it ships, so both platforms offer the same forms.
4. **Who sees what.** The form's creator sees the answers (and its co-owners, later). Every other
   member sees the title, purpose, open/closed and the share link. Response counts come from
   WhisperBox's state now, from its `formSummary(formId)` when that ships.
5. **On Android a form belongs to Frequencies' own WhisperBox identity**, so it doesn't show in the
   WhisperBox app on the same phone (and the other way round). On desktop both use the one
   `whisperbox_core`, so they share forms.

## Rejected

- **Answers in Scala events:** puts other people's private answers into a calendar every member reads,
  and duplicates WhisperBox's encryption.
- **A Frequencies-only form engine:** duplicates a working module (ADR 0001 §2).

## Consequences

- `frequencies_ui` depends on `whisperbox_core`, which needs a macOS build before Frequencies installs on
  a Mac.
- No change to Scala's or WhisperBox's data format.
