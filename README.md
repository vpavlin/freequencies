# Freequencies

A private, decentralized event-organisation app for the music and club-night scene: booking
nights, artists, crew, gear, budgets and promo, on the members' own devices, synced peer to peer
over the Logos Network. No server holds the data, so nobody can read it, sell it or switch it off.

Freequencies is not one big app. It composes reusable Basecamp modules (desktop) and Android apps
that already exist or are built for it, and adds the event-centred glue on top:

| Layer | What | Where |
|---|---|---|
| Freequencies | the event page linking artists, crew, budget, tasks and gear; booking rules; integrations | this repo |
| New modules | crew, gear, tasks | this repo (each its own module, reusable outside Freequencies) |
| Existing modules | [Scala](https://github.com/vpavlin/scala) (calendar, the spine) · [KYM](https://github.com/vpavlin/kym) (money) · [Kith](https://github.com/vpavlin/kith) (contacts, artists) · [Qaku](https://github.com/vpavlin/qaku) (Q&A) · WhisperBox (forms) | their own repos |
| Loam | [loam-transport](https://github.com/vpavlin/loam-transport) · [loam-sync](https://github.com/vpavlin/loam-sync) · [loam-keycard](https://github.com/vpavlin/loam-keycard) | shared by every app |
| Logos | Messaging (Waku) · Storage · Basecamp | the network |

## Status

Early. Step 1 of the [roadmap](docs/ROADMAP.md) is under way: the Scala features Freequencies
needs, built in the Scala repo so every Scala user gets them too.

## Documents

- [Roadmap and progress](docs/ROADMAP.md)
- [Decisions (ADRs)](docs/adr/0000-index.md)
- [The original plan](docs/plan-2026-09-22.md): requirements and where each one lives

## Licence

Dual-licensed under [MIT](LICENSE-MIT) or [Apache 2.0](LICENSE-APACHE), at your option.

## Docs

- [Demo script](docs/demo.md): a six-minute walkthrough on the shared demo calendar.
- [Integration guide](docs/integration-guide.md): how Freequencies builds on Scala, Kith and WhisperBox, desktop and Android, with code.
- [Roadmap](docs/ROADMAP.md) and [architecture decisions](docs/adr/0000-index.md).
