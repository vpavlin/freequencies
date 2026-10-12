# 0003. The Android app is built on scala-sdk and the shared Loam node

- Status: accepted
- Date: 2026-10-10

## Context

ADR 0002 made the desktop app a view over Scala's core module. On Android there is no core module to
call: each app runs its own copy of the engine and stores its own copy of each calendar's log.

## Decision

1. **`mobile/` is its own Expo app (`xyz.vpavlin.freequencies`) built on
   [scala-sdk](https://github.com/vpavlin/scala-sdk)**, mounted as a submodule at `mobile/src/lib`
   (Scala ADR 0025). It joins the same calendars as the Scala app and the desktop, with the same
   fields and comments, so a night edited anywhere shows everywhere.
2. **Sync only through the phone's shared Loam node.** The app embeds no node of its own (no
   `withLogosDelivery` native library), registers with Loam as `freequencies` (`setAppId`, before
   anything touches the transport), and shows Loam's status with the SDK's `SharedNodeStatus`. Without
   the Loam app it works offline and syncs once Loam runs.
3. **The phone board is a list, not columns:** 14 days, nights grouped by day, filter chips for venue
   and status. The night sheet, "new night" and "Use for Freequencies" match the desktop view. Calendars
   can be created (with the Freequencies fields) or joined from a `scala://join` link.
4. Own release key (`freequencies-release.jks`, outside the repo), same F-Droid flow as the other apps.

## Consequences

- The Freequencies app and the Scala app on one phone are two separate members of each calendar, each
  signing with its own identity unless both are bound to the same Loam identity. A night created in one
  can only be edited in the other by an owner/editor, or on a Collaborative calendar.
- Keycard support comes with the SDK (its native library loads at start-up), as in Scala.
