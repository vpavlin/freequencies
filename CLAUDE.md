# Frequencies — notes for contributing agents

Frequencies is an event-organisation app for the club scene, composed from Logos/Basecamp modules
with Scala as the spine. Read `docs/adr/0001-architecture.md` and `docs/ROADMAP.md` first.

- Follow the `logos-app-charter` skill (Basecamp + Android at parity, Loam, local-first, event log).
- Calendar features go to the Scala repo (vpavlin/scala), not here. Update `docs/ROADMAP.md` when
  one lands.
- Collaborators: the WhisperBox agent (forms) for booking/sign-up flows; a reviewer agent
  checks each prototype slice.
- Keep private hostnames and agent names out of committed files.
