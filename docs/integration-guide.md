# Building on Scala, Kith and WhisperBox

How an app reuses the calendars, contacts and forms of three existing Logos apps instead of
writing its own, on Basecamp (desktop) and Android. Frequencies is the worked example: everything
below is taken from its code (`frequencies-ui/qml/FrequenciesView.qml`, `mobile/App.tsx`) and its
ADRs (`docs/adr/0002`–`0005`).

| You need | Reuse | Desktop | Android |
|---|---|---|---|
| Events on a shared timeline | **Scala** | the `scala` core module | [scala-sdk](https://github.com/vpavlin/scala-sdk) |
| People (artists, crew, guests) | **Kith** | the `kith` core module | [kith-sdk](https://github.com/vpavlin/kith-sdk) |
| Questions to people outside the group | **WhisperBox** | the `whisperbox_core` module | [whisperbox-sdk](https://github.com/vpavlin/whisperbox-sdk) |

Each of these keeps its own encrypted, signed, multi-writer log and syncs it over Loam. Your app
reads and writes through them; it never stores a copy and never invents its own sync.

## 1. The one data rule

**Your app's data lives inside the host app's data, under your own namespace, and never changes
the host's wire format.** Two places are open to you in Scala:

- **Custom fields** on a calendar's events (Scala ADR 0005). The calendar declares them in its
  `schema`; every member sees them and Scala's own app shows and edits them. Frequencies uses
  `status` (Hold / Confirmed / Cancelled), `venue` and `type`.
- **`ext` items** attached to an event (Scala ADR 0021): `{ns, kind, target, id, data}`. Scala
  stores, signs, syncs and access-checks them but never reads `data`. Frequencies uses
  `ns: "xyz.frequencies"` with kinds `artist` (a line-up booking) and `form` (a linked
  WhisperBox form). Comments are Scala's own `ext` kind (`ns: "scala"`, `kind: "comment"`).

Rules that come with `ext`: the first author of an `id` owns it and is the only one who can change
its `data` by posting the same `id` again; the author or a calendar owner/editor can delete it.
Read every field with a type check: other people wrote it.

Kith and WhisperBox data are **referenced, not copied**: a booking stores the Kith contact id (plus
a name snapshot for when Kith isn't there), a night stores the WhisperBox form id and share link.
Who a person is stays in Kith; what they answered stays in WhisperBox.

## 2. Desktop: a Basecamp view over the core modules

A pure-QML view (`"type": "ui_qml"`) declares the modules it calls:

```json
{ "name": "frequencies_ui", "type": "ui_qml", "view": "qml/FrequenciesView.qml",
  "dependencies": ["scala", "kith", "whisperbox_core"] }
```

A view only reaches modules it declares. Mark one `optional_dependencies` if your app must still
load without it (loam_core does this for `keycard`).

**Never block the UI on a module call.** Every call is asynchronous; results arrive as JSON
strings (sometimes encoded twice, so unwrap until it isn't a string):

```qml
function callVia(module, method, args, cb) {
    logos.callModuleAsync(module, method, args || [], function (res) { cb(res) }, 20000)
}
function core(method, args, cb) { callVia("scala", method, args, cb) }
```

The calls Frequencies makes:

| Module | Call | For |
|---|---|---|
| `scala` | `listCalendars()`, `listAllEvents()` | the board; events come with their `ext` items |
| `scala` | `createEvent(calId, eventJson)` | a new night with its custom fields |
| `scala` | `getEvent(id)` then `updateEvent(eventJson)` | change a field: always start from the freshest copy, Scala replaces the whole event |
| `scala` | `postExt(calId, itemJson)`, `deleteExt(calId, id)` | bookings, form links, comments |
| `scala` | `updateCalendarMeta(calId, metaJson)` | add the Frequencies fields to a calendar's `schema` |
| `kith` | `listBooks()`, `listContacts(bookId)` | the artist picker |
| `whisperbox_core` | `createForm(defJson)`, `shareUri(formId)` | create a form, get the link to share |
| `whisperbox_core` | `formSummary(formId)` | open/closed, and the response count when you can read it |
| `whisperbox_core` | `getDecryptedResponses(formId)` | the answers (creator and co-owners only) |

Adding a booking from the desktop:

```js
var item = { ns: "xyz.frequencies", kind: "artist", target: night.id,
             data: { name: "DJ Example", contact: kithContactId, fee: 250, currency: "EUR",
                     set: "23:00–01:00", status: "asked" } }
core("postExt", [night.calendarId, JSON.stringify(item)], function (r) { /* {ok, id} */ })
```

Render everything other people wrote as plain text (`textFormat: Text.PlainText`).

## 3. Android: the SDKs in one app

On a phone there is no core module to call: the app runs each engine itself. Mount each SDK as a
git submodule and add their peer dependencies.

```sh
git submodule add https://github.com/vpavlin/scala-sdk      mobile/src/lib
git submodule add https://github.com/vpavlin/kith-sdk       mobile/src/kith
git submodule add https://github.com/vpavlin/whisperbox-sdk mobile/src/whisperbox
git submodule update --init --recursive
```

**One transport.** All three talk to the phone's shared Loam node through loam-transport, and the
app must hold exactly one copy of it:

- scala-sdk and kith-sdk each carry loam-transport as a submodule. Make Metro resolve kith-sdk's
  copy to scala-sdk's (`mobile/metro.config.js`) and keep both on the same commit
  (`mobile/test/one-transport.test.cjs` fails if they drift).
- whisperbox-sdk takes the transport as an argument, so it has no copy of its own.
- loam-transport `9963f22` or newer lets several engines share it: each calls `start()` with its own
  receiver and topics.

**Name your app to Loam before anything touches the transport**, once per engine:

```ts
import { setAppId, startSyncing } from "./src/lib/calendar";
import * as kith from "./src/kith/contacts";
import * as transport from "./src/lib/loam-transport";
import { setAppId as wbSetAppId, createWhisperbox } from "./src/whisperbox/rn";

setAppId("frequencies"); kith.setAppId("frequencies"); wbSetAppId("frequencies");
const wb = createWhisperbox({ transport });

await startSyncing(true);      // Scala, through the shared Loam node
await kith.startSyncing(true); // Kith joins the same transport
await wb.boot();               // WhisperBox too
```

The app then appears in Loam as one app ("frequencies"), approved once.

Two packaging details for whisperbox-sdk:

- It uses `@noble` v2 while scala-sdk and kith-sdk use v1. Give it its own copy
  (`"postinstall": "npm --prefix src/whisperbox install --no-save --ignore-scripts"`); Metro
  resolves each file's imports from the nearest `node_modules`, so both versions coexist.
- Its protocol is plain `.mjs`: add `"mjs"` to Metro's `resolver.sourceExts`. It stores its data
  with `expo-file-system`.

The same writes as on the desktop:

```ts
import { postExt } from "./src/lib/calendar";
import { template } from "./src/whisperbox/templates/templates.mjs";

await postExt(night.calendarId, { ns: "xyz.frequencies", kind: "artist", target: night.id,
                                  data: { name: "DJ Example", fee: 250, currency: "EUR", status: "asked" } });

const res = wb.client.createForm(template("guestlist", { title: "Guest list: Low End Theory" }));
const { uri } = wb.client.shareUri(res.formId);
await postExt(night.calendarId, { ns: "xyz.frequencies", kind: "form", target: night.id, id: res.formId,
                                  data: { formId: res.formId, uri, purpose: "guestlist" } });
```

Share one set of form templates between platforms: Frequencies generates the desktop's
`templates.js` from whisperbox-sdk's `templates.mjs` (`scripts/gen-qml-templates.mjs`, checked by
`npm test`).

## 4. Things that will bite you

- **Typed reads everywhere.** A field another member wrote can be any JSON type. In a C++ core,
  `nlohmann::json::value()` throws on a wrong type and the module dies; read with a type check.
  In a view or on the phone, a wrong type should never reach the UI as `undefined` or crash a render.
- **Fold parity.** Scala, Kith and KYM fold their logs in C++ (desktop) and TypeScript (phone); the
  two must give identical results, guarded by golden-vector parity tests in each app's repo. Engine
  changes go into the SDK first, then the app bumps the submodule and runs those tests.
- **Read before you write.** Scala replaces a whole event on update: fetch the current copy, change
  your field, save it, or you will erase someone else's concurrent edit.
- **A form's answers are private to its creator** (and co-owners). Other calendar members can see that
  a night has a guest list, but not who is on it or how many answered; `formSummary` gives them only
  the title, open/closed and the number of confirmations the creator has sent.
- **On Android each app has its own WhisperBox identity**, so forms created in Frequencies don't
  show in the WhisperBox app on the same phone. On desktop both share `whisperbox_core`.

## 5. Where to look

- Frequencies ADRs: 0002 (desktop view over Scala), 0003 (Android on scala-sdk), 0004 (artists from
  Kith), 0005 (forms from WhisperBox), 0006 (budget from KYM, proposed).
- Scala: `docs/sdk.md`, ADR 0005 (custom fields), 0021 (`ext` items), 0024 (comments), 0025 (scala-sdk).
- Kith: ADR 0007 (app integration), 0011 (kith-sdk). WhisperBox: `docs/SPEC.md`, ADR 0018.
- For agents: the `logos-app-sdk` skill in [logos-skills](https://github.com/vpavlin/logos-skills)
  turns an app's phone engine into a reusable SDK the same way.
