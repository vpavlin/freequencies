// Frequencies (Android) — organise club nights on top of Scala's calendars.
//
// Built on scala-sdk (mounted at src/lib): the same calendars, fields and comments as the Scala app
// and the desktop Frequencies view (ADR 0002). A night is a Scala event; Frequencies data is the
// calendar's Status / Venue / Type fields plus Scala's comments (ext items, ns "scala").
// Artists come from Kith (kith-sdk, mounted at src/kith); each night's line-up and fees are
// Frequencies ext items on the night (ADR 0004, src/app/lineup.ts).
// Sync goes through the phone's shared Loam node only (no embedded node): Loam must be installed.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ToastAndroid,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import DateTimePicker from "@react-native-community/datetimepicker";
import { store, Calendar, CalEvent } from "./src/lib/store";
import {
  onChange, startSyncing, setAppId, createEvent, updateEvent, createCalendar, updateCalendarMeta,
  joinFromInvite, postExt, deleteExt,
} from "./src/lib/calendar";
import { identityForCalendar } from "./src/lib/identities";
import { expandEvents } from "./src/lib/recur";
import { SharedNodeStatus } from "./src/lib/loam-transport-pkg/src/SharedNodeStatus";
import * as kith from "./src/kith/contacts";
import { store as kithStore, Book as KithBook, Contact as KithContact } from "./src/kith/store";
import { lineupOf, doubleBookings, feeLabel, totalFees, Booking, BookingStatus, STATUSES as BOOKING_STATUSES, NS, KIND_ARTIST } from "./src/app/lineup";

// Scala's Catppuccin tokens, so the two apps look like one family.
const C = {
  bg: "#1e1e2e", mantle: "#181825", surface: "#2a2a3c", surface2: "#313244", text: "#cdd6f4", sub: "#9399b2",
  faint: "#6c7086", blue: "#89b4fa", yellow: "#f9e2af", green: "#a6e3a1", red: "#f38ba8", mauve: "#cba6f7",
};

// ── the Frequencies schema (same contract as the desktop view, ADR 0002) ──────
const STATUSES = ["Hold", "Confirmed", "Cancelled"];
const TYPES = ["Club night", "Concert", "Residency", "Other"];
const FREQ_FIELDS = [
  { key: "status", label: "Status", type: "enum", options: STATUSES },
  { key: "venue", label: "Venue", type: "text" },
  { key: "type", label: "Type", type: "enum", options: TYPES },
];
const statusColor = (s: string) => (s === "Confirmed" ? C.green : s === "Cancelled" ? C.red : s === "Hold" ? C.yellow : C.faint);
const fieldOf = (ev: any, k: string): string => (ev && ev.fields && typeof ev.fields[k] === "string" ? ev.fields[k] : "");
const statusField = (c?: Calendar) => (c?.schema || []).find((f: any) => f && f.key === "status");
const isFreqStatusField = (f: any) => !!f && f.type === "enum" && Array.isArray(f.options) && STATUSES.every((s) => f.options.includes(s));
const isFreqCal = (c?: Calendar) => isFreqStatusField(statusField(c));
const DAY = 864e5;
const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fmtTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const toast = (m: string) => { if (Platform.OS === "android") ToastAndroid.show(m, ToastAndroid.SHORT); };
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Occ = CalEvent & { seriesId?: string; occ?: number; ext?: any[]; rsvps?: Record<string, string> };

export default function App() {
  const [cals, setCals] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("");
  const [meFor, setMeFor] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const [cs, es] = await Promise.all([store.listCalendars(), store.listEvents()]);
    setCals(cs);
    setEvents(es.filter((e) => !e.deleted));
    setLoading(false);
  }, []);

  // Kith: the artist books this phone has joined and their contacts (ADR 0004).
  const [kithBooks, setKithBooks] = useState<KithBook[]>([]);
  const [artists, setArtists] = useState<{ bookId: string; contact: KithContact }[]>([]);
  const reloadKith = useCallback(async () => {
    try {
      const [bs, cs] = await Promise.all([kithStore.listBooks(), kithStore.allContacts()]);
      setKithBooks(bs);
      setArtists(cs.filter((c) => c.contact && c.contact.name && c.contact.name.display));
    } catch { /* a broken Kith book must not take the board down */ }
  }, []);

  // Name ourselves to Loam BEFORE anything touches the transport (the shared backend is chosen once).
  // Both engines (Scala's and Kith's) register as "frequencies" and share one transport.
  useEffect(() => {
    setAppId("frequencies");
    kith.setAppId("frequencies");
    reload(); reloadKith();
    const off = onChange(() => { reload(); });
    const offK = kith.onChange(() => { reloadKith(); });
    startSyncing(true, setSyncStatus)
      .catch((e) => setSyncStatus("sync error: " + msg(e)))
      .then(() => kith.startSyncing(true))
      .catch(() => { /* Kith sync is optional: the line-up works with plain names */ });
    return () => { off(); offK(); };
  }, [reload, reloadKith]);

  // The address that authors on each calendar (its bound identity), for permission checks.
  useEffect(() => {
    let alive = true;
    (async () => {
      const pairs = await Promise.all(cals.map(async (c) => {
        try { return [c.id, (await identityForCalendar(c.id)).address] as const; } catch { return null; }
      }));
      if (alive) setMeFor(Object.fromEntries(pairs.filter((p): p is NonNullable<typeof p> => !!p)));
    })();
    return () => { alive = false; };
  }, [cals]);
  const isEditorOf = useCallback((c?: Calendar) => {
    if (!c) return false;
    const a = meFor[c.id];
    return !!a && (c.owner === a || c.roles?.[a] === "editor" || c.roles?.[a] === "admin");
  }, [meFor]);
  const canEdit = useCallback((ev?: CalEvent) => {
    const c = cals.find((x) => x.id === ev?.calendarId);
    if (!c || !ev) return false;
    const a = meFor[c.id];
    if (isEditorOf(c)) return true;
    if (c.roles?.[a] === "viewer") return false;
    return c.collab === true || (!!ev.creatorId && ev.creatorId === a);
  }, [cals, meFor, isEditorOf]);
  const canAddTo = useCallback((c?: Calendar) => !!c && (isEditorOf(c) || (c.roles?.[meFor[c.id]] !== "viewer" && c.open !== false)), [isEditorOf, meFor]);

  const freqCals = useMemo(() => cals.filter(isFreqCal), [cals]);
  const otherCals = useMemo(() => cals.filter((c) => !isFreqCal(c)), [cals]);

  // ── board: 14 days from firstDay, nights grouped by day, filter by venue / status ──
  const [firstDay, setFirstDay] = useState(() => startOfDay(Date.now()));
  const [venueFilter, setVenueFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const nights = useMemo(() => {
    const ids = new Set(freqCals.map((c) => c.id));
    return expandEvents(events.filter((e) => ids.has(e.calendarId)), firstDay, firstDay + 14 * DAY - 1) as Occ[];
  }, [events, freqCals, firstDay]);
  const doubles = useMemo(() => {
    const byId = new Map(events.map((e) => [e.id, e as Occ]));
    return doubleBookings(nights.map((n) => ({ key: `${n.id}@${n.occ}`, startTime: n.startTime, endTime: n.endTime, title: n.title, ext: byId.get(n.id)?.ext })));
  }, [nights, events]);
  const venues = useMemo(() => [...new Set(nights.map((n) => fieldOf(n, "venue")).filter(Boolean))].sort(), [nights]);
  const days = useMemo(() => {
    const shown = nights.filter((n) => (!venueFilter || fieldOf(n, "venue") === venueFilter) && (!statusFilter || fieldOf(n, "status") === statusFilter));
    const out: { date: number; items: Occ[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(firstDay); d.setDate(d.getDate() + i);
      const ds = d.getTime(), de = ds + DAY;
      out.push({ date: ds, items: shown.filter((n) => n.startTime >= ds && n.startTime < de).sort((a, b) => a.startTime - b.startTime) });
    }
    return out;
  }, [nights, venueFilter, statusFilter, firstDay]);
  const shift = (n: number) => setFirstDay((t) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); });

  // ── selected night ──
  const [selKey, setSelKey] = useState<{ id: string; occ?: number } | null>(null);
  const selOcc = useMemo(() => (selKey ? nights.find((n) => n.id === selKey.id && n.occ === selKey.occ) || null : null), [selKey, nights]);
  const selMaster = useMemo(() => (selKey ? (events.find((e) => e.id === selKey.id) as Occ) || null : null), [selKey, events]);
  const [saving, setSaving] = useState(false);
  // Scala replaces a whole event per edit: build it on the freshest stored copy (ADR 0002).
  const setField = async (key: string, value: string) => {
    if (!selMaster || saving) return;
    setSaving(true);
    try {
      const fresh = (await store.eventsFor(selMaster.calendarId)).find((e) => e.id === selMaster.id);
      if (!fresh) { toast("This night was deleted."); return; }
      await updateEvent({ ...fresh, fields: { ...(fresh.fields || {}), [key]: value } });
      toast("Saved");
      await reload();
    } catch (e) { Alert.alert("Couldn't save", msg(e)); }
    finally { setSaving(false); }
  };
  const [venueDraft, setVenueDraft] = useState("");
  useEffect(() => { setVenueDraft(fieldOf(selMaster, "venue")); }, [selMaster?.id, selMaster && fieldOf(selMaster, "venue")]);
  const comments = useMemo(() => ((selMaster?.ext || []) as any[]).filter((x) => x.ns === "scala" && x.kind === "comment"), [selMaster]);
  const [commentDraft, setCommentDraft] = useState("");
  const commentBusy = useRef(false);
  const postComment = async () => {
    const text = commentDraft.trim();
    if (!text || !selMaster || commentBusy.current) return;
    commentBusy.current = true;
    try { await postExt(selMaster.calendarId, { ns: "scala", kind: "comment", target: selMaster.id, data: { text } }); setCommentDraft(""); await reload(); }
    catch (e) { Alert.alert("Couldn't post the comment", msg(e)); }
    finally { commentBusy.current = false; }
  };
  // ── line-up (ADR 0004) ──
  const lineup = useMemo(() => lineupOf(selMaster || {}), [selMaster]);
  const [artistOpen, setArtistOpen] = useState(false);
  const blankDraft = { id: "", name: "", contact: "", book: "", fee: "", currency: "EUR", set: "", status: "asked" as BookingStatus };
  const [ad, setAd] = useState(blankDraft);
  const [artistQuery, setArtistQuery] = useState("");
  const artistBusy = useRef(false);
  const openArtist = (b?: Booking) => {
    setAd(b ? { id: b.id, name: b.name, contact: b.contact, book: b.book, fee: b.fee == null ? "" : String(b.fee), currency: b.currency || "EUR", set: b.set, status: b.status }
      : { ...blankDraft, currency: lineup.find((x) => x.currency)?.currency || "EUR" });
    setArtistQuery("");
    setArtistOpen(true);
  };
  const kithName = (b: { contact: string; name: string }) => artists.find((a) => a.contact.id === b.contact)?.contact.name.display || b.name;
  const matches = useMemo(() => {
    const q = artistQuery.trim().toLowerCase();
    if (!q) return artists.slice(0, 8);
    return artists.filter((a) => a.contact.name.display.toLowerCase().includes(q)).slice(0, 8);
  }, [artists, artistQuery]);
  const saveArtist = async () => {
    if (!selMaster || artistBusy.current) return;
    const name = ad.name.trim();
    if (!name) { Alert.alert("Pick an artist or type a name"); return; }
    const feeT = ad.fee.trim().replace(",", ".");
    const fee = feeT === "" ? null : Number(feeT);
    if (fee != null && !(isFinite(fee) && fee >= 0)) { Alert.alert("The fee should be a number", "For example 250 or 99.50."); return; }
    const data: Record<string, unknown> = { name, status: ad.status };
    if (ad.contact) { data.contact = ad.contact; data.book = ad.book; }
    if (fee != null) { data.fee = fee; data.currency = ad.currency.trim().toUpperCase(); }
    if (ad.set.trim()) data.set = ad.set.trim();
    artistBusy.current = true;
    try {
      await postExt(selMaster.calendarId, { ns: NS, kind: KIND_ARTIST, target: selMaster.id, id: ad.id || undefined, data });
      setArtistOpen(false); toast(ad.id ? "Booking updated" : "Artist added"); await reload();
    } catch (e) { Alert.alert("Couldn't save the booking", msg(e)); }
    finally { artistBusy.current = false; }
  };
  const removeArtist = (b: Booking) => {
    if (!selMaster) return;
    Alert.alert(`Remove ${b.name}?`, "They come off this night's line-up for everyone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { deleteExt(selMaster.calendarId, b.id).then(() => { setArtistOpen(false); toast("Removed"); return reload(); }).catch((e) => Alert.alert("Couldn't remove", msg(e))); } },
    ]);
  };
  const bookingColor = (st: BookingStatus) => (st === "confirmed" ? C.green : st === "cancelled" ? C.red : C.yellow);
  const statusWord = (st: BookingStatus) => st.charAt(0).toUpperCase() + st.slice(1);

  // ── Kith books (Calendars screen) ──
  const [kithLink, setKithLink] = useState("");
  const joinKith = async () => {
    const link = kithLink.trim();
    if (!link || busy) return;
    setBusy("kith");
    try {
      const b = await kith.joinFromInvite(link);
      if (!b) { Alert.alert("That link didn't work", "Paste a kith://join link from the Kith app (share a book there)."); return; }
      setKithLink(""); toast(`Joined “${b.name}”`); await reloadKith();
      kith.startSyncing(true).catch(() => {});
    } catch (e) { Alert.alert("Couldn't join the Kith book", msg(e)); }
    finally { setBusy(""); }
  };

  const rsvpLine = (ev?: Occ | null) => {
    const n: Record<string, number> = { going: 0, maybe: 0, no: 0 };
    for (const v of Object.values(ev?.rsvps || {})) if (n[v] !== undefined) n[v]++;
    return `${n.going} going · ${n.maybe} maybe · ${n.no} no`;
  };

  // ── new night ──
  const [newOpen, setNewOpen] = useState(false);
  const [nf, setNf] = useState({ calId: "", title: "", date: Date.now(), start: "22:00", end: "04:00", venue: "", status: "Hold" });
  const [pickDate, setPickDate] = useState(false);
  const creating = useRef(false);
  const openNew = (day?: number) => {
    const writable = freqCals.filter(canAddTo);
    if (!writable.length) { Alert.alert("No calendar to add to", "Set up a calendar for Frequencies first (Calendars)."); return; }
    setNf({ calId: writable.some((c) => c.id === nf.calId) ? nf.calId : writable[0].id, title: "", date: day ?? firstDay, start: "22:00", end: "04:00", venue: venueFilter, status: "Hold" });
    setNewOpen(true);
  };
  const atTime = (day: number, hhmm: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    const d = new Date(day); d.setHours(+m[1], +m[2], 0, 0); return d.getTime();
  };
  const createNight = async () => {
    if (creating.current) return;
    const s = atTime(nf.date, nf.start); let e = atTime(nf.date, nf.end);
    if (!nf.title.trim()) { Alert.alert("Give the night a name"); return; }
    if (s == null || e == null) { Alert.alert("Times look wrong", "Use 24-hour times like 22:00."); return; }
    if (e <= s) e += DAY; // ends after midnight
    creating.current = true;
    try {
      await createEvent(nf.calId, { title: nf.title.trim(), startTime: s, endTime: e, reminderMin: 60, fields: { status: nf.status, venue: nf.venue.trim(), type: "Club night" } } as any);
      setNewOpen(false); toast("Night added"); await reload();
    } catch (err) { Alert.alert("Couldn't add the night", msg(err)); }
    finally { creating.current = false; }
  };

  // ── calendars: set up, create, join ──
  const [calsOpen, setCalsOpen] = useState(false);
  const [newCalName, setNewCalName] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [busy, setBusy] = useState("");
  const adoptBlocker = (c: Calendar): string => {
    if (!isEditorOf(c)) return "Only its owner or editors can add Frequencies fields";
    const sf = statusField(c);
    if (sf && !isFreqStatusField(sf)) return "Has its own “status” field, so Frequencies leaves it alone";
    for (const f of c.schema || []) {
      if (f?.key === "venue" && f.type && f.type !== "text") return "Has its own “venue” field of another kind";
      if (f?.key === "type" && f.type && f.type !== "enum") return "Has its own “type” field of another kind";
    }
    return "";
  };
  const adopt = async (c: Calendar) => {
    const why = adoptBlocker(c);
    if (why) { Alert.alert("Can't use this calendar", why); return; }
    const schema = [...(c.schema || [])];
    for (const f of FREQ_FIELDS) if (!schema.some((x: any) => x?.key === f.key)) schema.push(f);
    setBusy(c.id);
    try { await updateCalendarMeta(c.id, { schema }); toast(`“${c.name}” now uses Frequencies`); await reload(); }
    catch (e) { Alert.alert("Couldn't update the calendar", msg(e)); }
    finally { setBusy(""); }
  };
  const createFreqCal = async () => {
    const name = newCalName.trim();
    if (!name || busy) return;
    setBusy("new");
    try { await createCalendar(name, "#cba6f7", "", undefined, { schema: FREQ_FIELDS, open: true }); setNewCalName(""); toast("Calendar created"); await reload(); }
    catch (e) { Alert.alert("Couldn't create the calendar", msg(e)); }
    finally { setBusy(""); }
  };
  const join = async () => {
    const link = joinLink.trim();
    if (!link || busy) return;
    setBusy("join");
    try {
      const c = await joinFromInvite(link);
      if (!c) { Alert.alert("That link didn't work", "Paste a scala://join link someone shared with you."); return; }
      setJoinLink(""); toast(`Joined “${c.name}”`); await reload();
      startSyncing(true, setSyncStatus).catch(() => {});
    } catch (e) { Alert.alert("Couldn't join", msg(e)); }
    finally { setBusy(""); }
  };

  // ── render ──
  const Chip = ({ label, on, color, onPress }: { label: string; on: boolean; color?: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[s.chip, on && { borderColor: color || C.blue, backgroundColor: C.surface }]}>
      <Text style={[s.chipT, on && { color: color || C.blue, fontWeight: "700" }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
  const rangeLabel = () => {
    const a = new Date(firstDay), b = new Date(firstDay); b.setDate(b.getDate() + 13);
    const f = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    return `${f(a)} – ${f(b)}`;
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={s.root}>
          <StatusBar style="light" />
          <View style={s.header}>
            <Text style={s.title}>Frequencies</Text>
            <Pressable onPress={() => setCalsOpen(true)} style={s.headerBtn}><Text style={s.headerBtnT}>Calendars</Text></Pressable>
          </View>
          <SharedNodeStatus appName="Frequencies" showSync style={{ marginHorizontal: 14 }} />

          <View style={s.rangeBar}>
            <Pressable hitSlop={10} onPress={() => shift(-7)}><Text style={s.nav}>‹</Text></Pressable>
            <Pressable onPress={() => setFirstDay(startOfDay(Date.now()))}><Text style={s.range}>{rangeLabel()}</Text></Pressable>
            <Pressable hitSlop={10} onPress={() => shift(7)}><Text style={s.nav}>›</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chipRow}>
            <Chip label="All venues" on={!venueFilter} onPress={() => setVenueFilter("")} />
            {venues.map((v) => <Chip key={v} label={v} on={venueFilter === v} onPress={() => setVenueFilter(venueFilter === v ? "" : v)} />)}
            <View style={s.chipSep} />
            {STATUSES.map((st) => <Chip key={st} label={st} on={statusFilter === st} color={statusColor(st)} onPress={() => setStatusFilter(statusFilter === st ? "" : st)} />)}
          </ScrollView>

          {loading ? <ActivityIndicator color={C.mauve} style={{ marginTop: 40 }} /> : freqCals.length === 0 ? (
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={s.empty}>No Frequencies calendars yet.</Text>
              <Text style={s.emptySub}>Open Calendars to create one, join one from an invite link, or set up a Scala calendar you already have.</Text>
              <Pressable onPress={() => setCalsOpen(true)} style={s.primaryBtn}><Text style={s.primaryBtnT}>Open Calendars</Text></Pressable>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 90 }}>
              {days.map((d) => {
                const date = new Date(d.date); const g = date.getDay(); const today = startOfDay(Date.now()) === d.date;
                return (
                  <View key={d.date} style={[s.day, (g === 5 || g === 6) && { backgroundColor: C.mantle }]}>
                    <Pressable onLongPress={() => openNew(d.date)} style={s.dayHead}>
                      <Text style={[s.dayT, today && { color: C.yellow }]}>{date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</Text>
                    </Pressable>
                    {d.items.length === 0 ? <Text style={s.none}>—</Text> : d.items.map((n) => {
                      const st = fieldOf(n, "status");
                      return (
                        <Pressable key={`${n.id}-${n.occ}`} onPress={() => setSelKey({ id: n.id, occ: n.occ })} style={s.night}>
                          <View style={[s.bar, { backgroundColor: statusColor(st) }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.nightT, st === "Cancelled" && { textDecorationLine: "line-through", color: C.sub }]} numberOfLines={1}>{n.title || "(untitled)"}</Text>
                            <Text style={s.nightS} numberOfLines={1}>{fmtTime(n.startTime)}{fieldOf(n, "venue") ? ` · ${fieldOf(n, "venue")}` : ""}{st ? ` · ${st}` : ""}</Text>
                            {doubles.has(`${n.id}@${n.occ}`) && <Text style={s.warn} numberOfLines={1}>⚠ {doubles.get(`${n.id}@${n.occ}`)![0].artist} is also booked at {doubles.get(`${n.id}@${n.occ}`)![0].other.title || "another night"}</Text>}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
              <Text style={s.hint}>Long-press a day to add a night on it.</Text>
            </ScrollView>
          )}
          {freqCals.length > 0 && (
            <Pressable onPress={() => openNew()} style={s.fab}><Text style={s.fabT}>+ Night</Text></Pressable>
          )}
          {!!syncStatus && syncStatus.startsWith("sync error") && <Text style={s.err}>{syncStatus}</Text>}

          {/* ── night sheet ── */}
          <Modal visible={!!selKey} transparent animationType="slide" onRequestClose={() => setSelKey(null)}>
            <View style={s.sheetWrap}>
              <View style={s.sheet}>
                {selMaster && (
                  <ScrollView keyboardShouldPersistTaps="handled">
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <Text style={[s.sheetTitle, { flex: 1 }]}>{selMaster.title || "(untitled)"}</Text>
                      <Pressable hitSlop={10} onPress={() => setSelKey(null)}><Text style={s.close}>✕</Text></Pressable>
                    </View>
                    <Text style={s.sub}>
                      {selOcc ? `${new Date(selOcc.startTime).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, ${fmtTime(selOcc.startTime)}–${fmtTime(selOcc.endTime)}` : ""}
                      {"  ·  "}{cals.find((c) => c.id === selMaster.calendarId)?.name || ""}
                    </Text>
                    {!canEdit(selMaster) && <Text style={s.readonly}>Read-only: you can't edit this night on this calendar.</Text>}
                    <Text style={s.label}>Status</Text>
                    <View style={s.wrap}>{STATUSES.map((st) => (
                      <Chip key={st} label={st} on={fieldOf(selMaster, "status") === st} color={statusColor(st)} onPress={() => { if (canEdit(selMaster) && fieldOf(selMaster, "status") !== st) setField("status", st); }} />
                    ))}</View>
                    <Text style={s.label}>Venue</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput style={[s.input, { flex: 1 }]} value={venueDraft} onChangeText={setVenueDraft} editable={canEdit(selMaster)} placeholder="Where it happens" placeholderTextColor={C.faint} />
                      <Pressable disabled={!canEdit(selMaster) || venueDraft.trim() === fieldOf(selMaster, "venue") || saving} onPress={() => setField("venue", venueDraft.trim())}
                        style={[s.smallBtn, (!canEdit(selMaster) || venueDraft.trim() === fieldOf(selMaster, "venue")) && { opacity: 0.4 }]}><Text style={s.smallBtnT}>Save</Text></Pressable>
                    </View>
                    <Text style={s.label}>Type</Text>
                    <View style={s.wrap}>{TYPES.map((t) => (
                      <Chip key={t} label={t} on={fieldOf(selMaster, "type") === t} onPress={() => { if (canEdit(selMaster) && fieldOf(selMaster, "type") !== t) setField("type", t); }} />
                    ))}</View>
                    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                      <Text style={[s.label, { flex: 1 }]}>Line-up ({lineup.length})</Text>
                      <Pressable hitSlop={8} onPress={() => openArtist()} style={{ marginBottom: 6 }}><Text style={{ color: C.blue, fontSize: 13 }}>+ Artist</Text></Pressable>
                    </View>
                    {lineup.length === 0 && <Text style={s.sub}>No artists yet.</Text>}
                    {lineup.map((b) => (
                      <Pressable key={b.id} onPress={() => openArtist(b)} style={s.booking}>
                        <View style={[s.dot, { backgroundColor: bookingColor(b.status) }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.body, b.status === "cancelled" && { textDecorationLine: "line-through", color: C.sub }]} numberOfLines={1}>{kithName(b)}</Text>
                          <Text style={s.sub} numberOfLines={1}>{[b.set, statusWord(b.status), feeLabel(b), b.contact ? "" : "not in Kith"].filter(Boolean).join(" · ")}</Text>
                        </View>
                      </Pressable>
                    ))}
                    {totalFees(lineup).length > 0 && <Text style={s.sub}>Fees: {totalFees(lineup).map((t) => (t.currency ? `${t.total} ${t.currency}` : String(t.total))).join(" + ")}</Text>}
                    {selOcc && doubles.get(`${selOcc.id}@${selOcc.occ}`)?.map((d, i) => (
                      <Text key={i} style={s.warn}>⚠ {d.artist} is also booked at {d.other.title || "another night"}, {new Date(d.other.startTime).toLocaleDateString(undefined, { day: "numeric", month: "short" })} {fmtTime(d.other.startTime)}</Text>
                    ))}
                    {!!selMaster.description && (<><Text style={s.label}>Notes</Text><Text style={s.body}>{selMaster.description}</Text></>)}
                    <Text style={[s.sub, { marginTop: 10 }]}>Attendance: {rsvpLine(selMaster)}</Text>
                    <Text style={s.label}>Comments ({comments.length})</Text>
                    {comments.map((c) => {
                      const mine = c.author === meFor[selMaster.calendarId];
                      const canDel = mine || isEditorOf(cals.find((x) => x.id === selMaster.calendarId));
                      return (
                        <View key={c.id} style={s.comment}>
                          <View style={{ flexDirection: "row" }}>
                            <Text style={[s.sub, { flex: 1 }]} numberOfLines={1}>{mine ? "You" : `${String(c.author).slice(0, 8)}…`} · {new Date(c.hlc?.wall || 0).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                            {canDel && <Pressable hitSlop={8} onPress={() => deleteExt(selMaster.calendarId, c.id).then(reload).catch((e) => Alert.alert("Couldn't delete", msg(e)))}><Text style={{ color: C.red, fontSize: 12 }}>Delete</Text></Pressable>}
                          </View>
                          <Text style={s.body}>{c.data && typeof c.data.text === "string" ? c.data.text : "(empty)"}</Text>
                        </View>
                      );
                    })}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TextInput style={[s.input, { flex: 1 }]} value={commentDraft} onChangeText={setCommentDraft} placeholder="Add a comment…" placeholderTextColor={C.faint} multiline maxLength={2000} />
                      <Pressable onPress={postComment} disabled={!commentDraft.trim()} style={[s.smallBtn, !commentDraft.trim() && { opacity: 0.4 }]}><Text style={s.smallBtnT}>Post</Text></Pressable>
                    </View>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>

          {/* ── artist booking ── */}
          <Modal visible={artistOpen} transparent animationType="slide" onRequestClose={() => setArtistOpen(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.sheetWrap}>
              <View style={s.sheet}>
                {(() => {
                  const editing = lineup.find((b) => b.id === ad.id);
                  const mine = !editing || editing.author === meFor[selMaster?.calendarId || ""];
                  const canRemove = !!editing && (mine || isEditorOf(cals.find((c) => c.id === selMaster?.calendarId)));
                  return (
                    <ScrollView keyboardShouldPersistTaps="handled">
                      <View style={{ flexDirection: "row" }}>
                        <Text style={[s.sheetTitle, { flex: 1 }]}>{editing ? kithName(editing) : "Add an artist"}</Text>
                        <Pressable hitSlop={10} onPress={() => setArtistOpen(false)}><Text style={s.close}>✕</Text></Pressable>
                      </View>
                      {!mine && <Text style={s.readonly}>Only the person who added this booking can change it. Editors can remove it.</Text>}
                      {!editing && (<>
                        <Text style={s.label}>From Kith</Text>
                        {kithBooks.length === 0 ? (
                          <Text style={s.sub}>No Kith books on this phone. Join your crew's artist book under Calendars, or type a name below.</Text>
                        ) : (<>
                          <TextInput style={s.input} value={artistQuery} onChangeText={setArtistQuery} placeholder="Search artists" placeholderTextColor={C.faint} />
                          <View style={[s.wrap, { marginTop: 8 }]}>
                            {matches.map((a) => (
                              <Chip key={a.contact.id} label={a.contact.name.display} on={ad.contact === a.contact.id}
                                onPress={() => setAd({ ...ad, contact: a.contact.id, book: a.bookId, name: a.contact.name.display })} />
                            ))}
                            {matches.length === 0 && <Text style={s.sub}>No match in Kith.</Text>}
                          </View>
                        </>)}
                      </>)}
                      <Text style={s.label}>Name</Text>
                      <TextInput style={s.input} value={ad.name} editable={mine} onChangeText={(t) => setAd({ ...ad, name: t, ...(ad.contact && t !== ad.name ? { contact: "", book: "" } : {}) })} placeholder="Artist name" placeholderTextColor={C.faint} />
                      {!!ad.contact && <Text style={s.sub}>Linked to Kith</Text>}
                      <Text style={s.label}>Set</Text>
                      <TextInput style={s.input} value={ad.set} editable={mine} onChangeText={(t) => setAd({ ...ad, set: t })} placeholder="e.g. 23:00–01:00" placeholderTextColor={C.faint} />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 2 }}><Text style={s.label}>Fee</Text><TextInput style={s.input} value={ad.fee} editable={mine} onChangeText={(t) => setAd({ ...ad, fee: t })} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={C.faint} /></View>
                        <View style={{ flex: 1 }}><Text style={s.label}>Currency</Text><TextInput style={s.input} value={ad.currency} editable={mine} onChangeText={(t) => setAd({ ...ad, currency: t })} autoCapitalize="characters" maxLength={4} /></View>
                      </View>
                      <Text style={s.sub}>Everyone in this calendar can see fees.</Text>
                      <Text style={s.label}>Status</Text>
                      <View style={s.wrap}>{BOOKING_STATUSES.map((st) => <Chip key={st} label={statusWord(st)} on={ad.status === st} color={bookingColor(st)} onPress={() => { if (mine) setAd({ ...ad, status: st }); }} />)}</View>
                      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                        {canRemove ? <Pressable onPress={() => editing && removeArtist(editing)} style={[s.secondaryBtn, { flex: 1 }]}><Text style={[s.secondaryBtnT, { color: C.red }]}>Remove</Text></Pressable>
                          : <Pressable onPress={() => setArtistOpen(false)} style={[s.secondaryBtn, { flex: 1 }]}><Text style={s.secondaryBtnT}>Cancel</Text></Pressable>}
                        {mine && <Pressable onPress={saveArtist} style={[s.primaryBtn, { flex: 1 }]}><Text style={s.primaryBtnT}>{editing ? "Save" : "Add"}</Text></Pressable>}
                      </View>
                    </ScrollView>
                  );
                })()}
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* ── new night ── */}
          <Modal visible={newOpen} transparent animationType="slide" onRequestClose={() => setNewOpen(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.sheetWrap}>
              <View style={s.sheet}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <Text style={s.sheetTitle}>New night</Text>
                  <Text style={s.label}>Calendar</Text>
                  <View style={s.wrap}>{freqCals.filter(canAddTo).map((c) => <Chip key={c.id} label={c.name} on={nf.calId === c.id} onPress={() => setNf({ ...nf, calId: c.id })} />)}</View>
                  <Text style={s.label}>Name</Text>
                  <TextInput style={s.input} value={nf.title} onChangeText={(t) => setNf({ ...nf, title: t })} placeholder="e.g. Bassline Fridays" placeholderTextColor={C.faint} />
                  <Text style={s.label}>Date</Text>
                  <Pressable onPress={() => setPickDate(true)} style={s.input}><Text style={{ color: C.text }}>{new Date(nf.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</Text></Pressable>
                  {pickDate && <DateTimePicker value={new Date(nf.date)} mode="date" onChange={(_e, d) => { setPickDate(false); if (d) setNf({ ...nf, date: startOfDay(d.getTime()) }); }} />}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}><Text style={s.label}>Doors</Text><TextInput style={s.input} value={nf.start} onChangeText={(t) => setNf({ ...nf, start: t })} keyboardType="numbers-and-punctuation" /></View>
                    <View style={{ flex: 1 }}><Text style={s.label}>Ends</Text><TextInput style={s.input} value={nf.end} onChangeText={(t) => setNf({ ...nf, end: t })} keyboardType="numbers-and-punctuation" /></View>
                  </View>
                  <Text style={s.label}>Venue</Text>
                  <TextInput style={s.input} value={nf.venue} onChangeText={(t) => setNf({ ...nf, venue: t })} placeholder="Where it happens" placeholderTextColor={C.faint} />
                  <Text style={s.label}>Status</Text>
                  <View style={s.wrap}>{STATUSES.map((st) => <Chip key={st} label={st} on={nf.status === st} color={statusColor(st)} onPress={() => setNf({ ...nf, status: st })} />)}</View>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <Pressable onPress={() => setNewOpen(false)} style={[s.secondaryBtn, { flex: 1 }]}><Text style={s.secondaryBtnT}>Cancel</Text></Pressable>
                    <Pressable onPress={createNight} style={[s.primaryBtn, { flex: 1 }]}><Text style={s.primaryBtnT}>Add night</Text></Pressable>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* ── calendars ── */}
          <Modal visible={calsOpen} transparent animationType="slide" onRequestClose={() => setCalsOpen(false)}>
            <View style={s.sheetWrap}>
              <View style={s.sheet}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={{ flexDirection: "row" }}>
                    <Text style={[s.sheetTitle, { flex: 1 }]}>Calendars</Text>
                    <Pressable hitSlop={10} onPress={() => setCalsOpen(false)}><Text style={s.close}>✕</Text></Pressable>
                  </View>
                  <Text style={s.label}>Frequencies calendars</Text>
                  {freqCals.length === 0 ? <Text style={s.sub}>None yet.</Text> : freqCals.map((c) => <Text key={c.id} style={s.calRow}>● {c.name}</Text>)}
                  <Text style={s.label}>New calendar</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput style={[s.input, { flex: 1 }]} value={newCalName} onChangeText={setNewCalName} placeholder="e.g. Basement Collective" placeholderTextColor={C.faint} />
                    <Pressable onPress={createFreqCal} disabled={!newCalName.trim() || !!busy} style={[s.smallBtn, (!newCalName.trim() || !!busy) && { opacity: 0.4 }]}><Text style={s.smallBtnT}>{busy === "new" ? "…" : "Create"}</Text></Pressable>
                  </View>
                  <Text style={s.label}>Join from an invite link</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput style={[s.input, { flex: 1 }]} value={joinLink} onChangeText={setJoinLink} placeholder="scala://join?…" placeholderTextColor={C.faint} autoCapitalize="none" />
                    <Pressable onPress={join} disabled={!joinLink.trim() || !!busy} style={[s.smallBtn, (!joinLink.trim() || !!busy) && { opacity: 0.4 }]}><Text style={s.smallBtnT}>{busy === "join" ? "…" : "Join"}</Text></Pressable>
                  </View>
                  {otherCals.length > 0 && <Text style={s.label}>Other calendars on this phone</Text>}
                  {otherCals.map((c) => {
                    const why = adoptBlocker(c);
                    return (
                      <View key={c.id} style={{ marginTop: 8 }}>
                        <Text style={s.body}>{c.name}</Text>
                        {why ? <Text style={s.sub}>{why}</Text> : (
                          <Pressable onPress={() => adopt(c)} disabled={!!busy}><Text style={{ color: C.blue, fontSize: 13 }}>{busy === c.id ? "Setting up…" : "Use for Frequencies"}</Text></Pressable>
                        )}
                      </View>
                    );
                  })}
                  <Text style={s.label}>Artist books (Kith)</Text>
                  {kithBooks.length === 0 ? <Text style={s.sub}>None yet. In the Kith app, share your crew's artist book and paste its link here.</Text>
                    : kithBooks.map((b) => <Text key={b.id} style={s.calRow}>● {b.name}{typeof b.contactCount === "number" ? ` (${b.contactCount})` : ""}</Text>)}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TextInput style={[s.input, { flex: 1 }]} value={kithLink} onChangeText={setKithLink} placeholder="kith://join?…" placeholderTextColor={C.faint} autoCapitalize="none" />
                    <Pressable onPress={joinKith} disabled={!kithLink.trim() || !!busy} style={[s.smallBtn, (!kithLink.trim() || !!busy) && { opacity: 0.4 }]}><Text style={s.smallBtnT}>{busy === "kith" ? "…" : "Join"}</Text></Pressable>
                  </View>
                  <Text style={[s.sub, { marginTop: 18 }]}>Nights are Scala events: they also show in the Scala app and on desktop, and comments are shared. Syncing needs the Loam app on this phone.</Text>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  title: { color: C.text, fontSize: 22, fontWeight: "700", flex: 1 },
  headerBtn: { borderWidth: 1, borderColor: C.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  headerBtnT: { color: C.text, fontSize: 13 },
  rangeBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, paddingVertical: 6 },
  nav: { color: C.mauve, fontSize: 24, paddingHorizontal: 8 },
  range: { color: C.text, fontSize: 16, fontWeight: "600" },
  chipRow: { gap: 6, paddingHorizontal: 14, paddingBottom: 8, alignItems: "center" },
  chip: { borderWidth: 1, borderColor: C.surface2, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipT: { color: C.sub, fontSize: 12 },
  chipSep: { width: 1, height: 18, backgroundColor: C.surface2, marginHorizontal: 2 },
  day: { paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.surface2 },
  dayHead: { paddingVertical: 4 },
  dayT: { color: C.sub, fontSize: 13, fontWeight: "600" },
  none: { color: C.faint, fontSize: 12, paddingBottom: 4 },
  night: { flexDirection: "row", gap: 10, backgroundColor: C.surface, borderRadius: 8, padding: 10, marginVertical: 3 },
  bar: { width: 4, borderRadius: 2 },
  nightT: { color: C.text, fontSize: 15, fontWeight: "600" },
  nightS: { color: C.sub, fontSize: 12, marginTop: 2 },
  hint: { color: C.faint, fontSize: 12, textAlign: "center", marginTop: 12 },
  fab: { position: "absolute", right: 18, bottom: 24, backgroundColor: C.mauve, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, elevation: 4 },
  fabT: { color: "#11111b", fontSize: 15, fontWeight: "700" },
  err: { color: C.red, fontSize: 12, paddingHorizontal: 14, paddingBottom: 6 },
  empty: { color: C.text, fontSize: 17, fontWeight: "600" },
  emptySub: { color: C.sub, fontSize: 14 },
  primaryBtn: { backgroundColor: C.mauve, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primaryBtnT: { color: "#11111b", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { backgroundColor: C.surface2, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  secondaryBtnT: { color: C.text, fontSize: 15, fontWeight: "600" },
  sheetWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18, maxHeight: "90%" },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: "700" },
  close: { color: C.sub, fontSize: 18 },
  sub: { color: C.sub, fontSize: 12, marginTop: 2 },
  readonly: { color: C.faint, fontSize: 12, marginTop: 6 },
  label: { color: C.faint, fontSize: 11, marginTop: 14, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  input: { backgroundColor: C.mantle, borderWidth: 1, borderColor: C.surface2, borderRadius: 8, color: C.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  smallBtn: { backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  smallBtnT: { color: C.text, fontSize: 14, fontWeight: "600" },
  body: { color: C.text, fontSize: 14 },
  comment: { borderLeftWidth: 2, borderLeftColor: C.surface2, paddingLeft: 8, marginTop: 8 },
  calRow: { color: C.text, fontSize: 14, marginTop: 4 },
  booking: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: 8, padding: 10, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  warn: { color: C.yellow, fontSize: 12, marginTop: 4 },
});
