# Demo script: Frequencies in 7 minutes

For showing Frequencies to an event organiser: a promoter, a venue, a collective. One laptop with
Basecamp, one Android phone. Everything runs on the demo calendar "Basement Collective (demo)",
which an always-on hub keeps available. All names and fees are made up.

## Before (10 minutes, once)

**Phone:** install from the F-Droid repo on [frequencies.vpavlin.xyz](https://frequencies.vpavlin.xyz):
**Loam** (0.0.55 or newer) and **Frequencies**. Open Loam once and leave it running; open
Frequencies and approve it in Loam when asked. Optional: the **WhisperBox** app on a second phone,
to answer a form live.

**Laptop:** Basecamp 0.3. Add the package repository `https://frequencies.vpavlin.xyz/logos-repo.json`
and install **Frequencies**, **Scala** and **Kith** (their modules come along).

**Join the demo calendar on both.** Phone: Frequencies → Calendars → *Join from an invite link*.
Laptop: Scala → *Join calendar*. Paste:

```
scala://join?id=52fd405a-1fa7-4373-8e91-f8406e91e38a&key=YWZiYmVmMjUtYzNjNC00NmE2LTk3N2MtZTBlMWU1M2U2ZTg1NWRlYWQzZTYtMTA4MC00Zjk3LWJjZjktZDkyNDQ1YzQyODAy&name=Basement%20Collective%20%28demo%29
```

Give it a few minutes to fill in (11 nights across October). Check both screens show the same
nights before you start. The calendar is open to anyone with the link: other people may have
edited it, which is fine, it's a demo.

## The demo

**1. The board (laptop, 1 min).** Open Frequencies.
- "Every night your crew is planning, one row per day, one column per venue." Point at
  Cross Club / Ankali / Café v lese.
- Click *By status*: "What's still on hold versus locked in." The cancelled Afterhours is struck
  through, not hidden.
- *Say:* there's no server. This calendar lives on the devices of the people in it, encrypted.

**2. A night (laptop, 1 min).** Click **Low End Theory** (Sat 10 Oct).
- Status, venue, type at the top. The **line-up**: who plays when, for how much, asked or
  confirmed, and the fee total.
- Point at the yellow line: **"DJ Nikola is also booked at Techno Lab"**. "It noticed the same
  artist on two nights at the same time. A warning, not a block."
- The comments: the crew's conversation about this night, next to the night, not lost in a group chat.

**3. Change something, watch the phone (1 min).**
- On the laptop, set **Techno Lab** from *Hold* to *Confirmed*.
- On the phone, the same night turns green within seconds. "No server: the laptop and the phone
  talked to each other."
- On the phone, add a comment on Techno Lab ("Nikola moved to 02:00"). It appears on the laptop.

**4. Book an artist (phone, 1 min).** Open **Halloween Bass** → *+ Artist*.
- Type a name, a set time ("02:00–04:00"), a fee, leave it *Asked*. Save.
- "Everyone in the crew sees it. Only the crew: the calendar is encrypted to its members."
- If you have a Kith "Artists" book joined, pick from it instead and say: "the address book is
  its own app; Frequencies just links to the person."

**5. The crew (laptop, 30 s; Frequencies 0.4.0 or newer).** Back on **Low End Theory**, scroll to *Crew*.
- Door, bar and sound, each with a call time; the green *Here ✓* shows who has arrived. "Whoever
  is on the door checks people in from their phone."
- Open **Dub Session**: an open bar slot. "The board shows which nights still need people."

**6. A guest list (phone or laptop, 1 min).** On **Halloween Bass** → *+ Form* → *Guest list*.
- *Share link* → send it to the second phone (or show the link). "Guests answer in WhisperBox.
  Only you can read the answers; even the rest of the crew only sees that there's a guest list."
- If someone answers live: the count on the night goes up; *Answers* shows the names.

**7. It's still a calendar (laptop, 30 s).** Open **Scala** (the calendar app).
- The same nights, the same comments. "Anyone in your team who only wants a calendar uses this;
  Frequencies is the promoter's view on top."

## If something goes wrong

- **Nights don't appear on the phone:** check Loam is running and Frequencies is approved there
  (Frequencies shows a Loam banner at the top if not). Give it a minute; reopening the app makes it ask again.
- **The laptop shows no Frequencies calendars:** Scala must have joined the demo calendar first.
- **Nothing syncs at all:** the hub may be restarting (it restarts itself if it gets stuck); wait
  two minutes. The phone and laptop also sync directly when both are online.

## What to leave them with

- Phone + desktop, same data, no server, no account.
- Built from apps they can use on their own: Scala (calendar), Kith (contacts), WhisperBox (forms).
- [frequencies.vpavlin.xyz](https://frequencies.vpavlin.xyz) to install;
  [the review with screenshots](https://data.vpavlin.xyz/reviews/frequencies/) to read later.
