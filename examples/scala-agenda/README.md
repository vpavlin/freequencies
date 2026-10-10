# Scala Agenda: a minimal app on top of Scala

A complete Basecamp module in one QML file (~130 lines): it lists the next 7 days of events from every
Scala calendar on the machine and lets you add a comment to an event. Copy it as the starting point
for your own app on Scala. The rules it follows are in [../../docs/integration-guide.md](../../docs/integration-guide.md).

| File | What |
|---|---|
| `metadata.json` | a pure-QML view (`ui_qml`) that declares `scala` as a dependency |
| `flake.nix` | builds the `.lgx` with logos-module-builder 0.3.1, pinned to a Scala commit |
| `qml/AgendaView.qml` | the view: async calls to the scala core, JSON unwrapping, typed reads, plain text |

What it shows:

- **Reading:** `listCalendars()` and `listAllEvents()` from the `scala` core module.
- **Writing:** `postExt(calendarId, item)` adds a comment, an `ext` item with `ns: "scala"`,
  `kind: "comment"`. Your own app's data uses your own namespace the same way.
- **Never blocking:** every call is `logos.callModuleAsync(...)`; the view updates when the answer comes.

## Build and install

```sh
nix build .#lgx-portable        # -> result/logos-scala_agenda_example-module.lgx
```

In Basecamp 0.3, install **Scala** from `https://apps.vpavlin.xyz/logos-repo.json`, then install the
built `.lgx` with *Install local package*. The view appears as "Scala Agenda (example)".

Left out to keep it short: recurring events (expand them as Scala does; see `expandEvent` in
`frequencies-ui/qml/FrequenciesView.qml`) and editing events (`getEvent` then `updateEvent`).
