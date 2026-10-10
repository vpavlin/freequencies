// Frequencies — organise club nights on top of the Scala calendar.
//
// A pure-QML view over the `scala` core module (ADR 0001 / 0002): it reads and writes Scala's
// calendars, so every night is an ordinary Scala event and shows up in Scala too. Frequencies'
// own data rides in Scala's mechanisms: the calendar's custom fields (Status, Venue, Type) and
// Scala's per-event comments (ext items, ns "scala", kind "comment").
//
// Rules carried over from the Scala view: every core call is async (callVia), results are
// double-JSON-encoded (j()), all text that other people wrote is Text.PlainText.
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import Logos.Theme
import Logos.Controls

Item {
    id: root
    width: 1100
    height: 720

    // ── core bridge (same pattern as Scala's view) ───────────────────────────────
    property bool ready: false
    readonly property int callTimeoutMs: 20000
    function hasBridge() {
        return typeof logos !== "undefined" && logos !== null
            && (typeof logos.callModuleAsync === "function" || typeof logos.callModule === "function")
    }
    function _deliver(cb, raw) {
        if (!cb) return
        try { cb(raw === undefined || raw === null ? "" : raw) }
        catch (e) { console.warn("frequencies: callback error: " + e) }
    }
    function callVia(module, method, args, cb) {
        var a = args || []
        if (!root.hasBridge()) { Qt.callLater(function () { root._deliver(cb, "") }); return }
        if (typeof logos.callModuleAsync === "function") {
            try { logos.callModuleAsync(module, method, a, function (res) { root._deliver(cb, res) }, root.callTimeoutMs) }
            catch (e) { console.warn("frequencies: callModuleAsync threw: " + e); Qt.callLater(function () { root._deliver(cb, "") }) }
            return
        }
        Qt.callLater(function () {
            var raw = ""
            try { raw = logos.callModule(module, method, a) } catch (e) { raw = "" }
            root._deliver(cb, raw)
        })
    }
    function core(method, args, cb) { root.callVia("scala", method, args, cb) }
    function j(raw, fallback) {
        var v = raw
        for (var i = 0; i < 3 && typeof v === "string"; i++) {
            var t = v.trim()
            if (t === "") return fallback
            try { v = JSON.parse(t) } catch (e) { return (i === 0 ? fallback : v) }
        }
        return (v === undefined || v === null) ? fallback : v
    }

    // ── tokens (Scala's Catppuccin set, so both apps look like one family) ───────
    readonly property color cBase:    "#1e1e2e"
    readonly property color cMantle:  "#181825"
    readonly property color cCrust:   "#11111b"
    readonly property color cSurface: "#2a2a3c"
    readonly property color cSurface2:"#313244"
    readonly property color cText:    "#cdd6f4"
    readonly property color cSub:     "#9399b2"
    readonly property color cFaint:   "#6c7086"
    readonly property color cBlue:    "#89b4fa"
    readonly property color cYellow:  "#f9e2af"
    readonly property color cGreen:   "#a6e3a1"
    readonly property color cRed:     "#f38ba8"
    readonly property color cMauve:   "#cba6f7"
    readonly property color cPink:    "#f5c2e7"

    // ── the Frequencies schema: custom fields a calendar gets when it's used for Frequencies ──
    readonly property var statuses: ["Hold", "Confirmed", "Cancelled"]
    readonly property var types: ["Club night", "Concert", "Residency", "Other"]
    readonly property var freqFields: [
        { key: "status", label: "Status", type: "enum", options: root.statuses },
        { key: "venue", label: "Venue", type: "text" },
        { key: "type", label: "Type", type: "enum", options: root.types }
    ]
    // Colour comes from the status field (ADR 0001 §4), not from the calendar.
    function statusColor(s) {
        return s === "Confirmed" ? root.cGreen : s === "Cancelled" ? root.cRed : s === "Hold" ? root.cYellow : root.cFaint
    }
    function fieldOf(ev, k) { return (ev && ev.fields && typeof ev.fields[k] === "string") ? ev.fields[k] : "" }

    // ── data ─────────────────────────────────────────────────────────────────────
    property var calendars: []
    property var events: []
    property bool loading: true
    property string loadError: ""
    property bool refreshing: false
    property string coreVer: ""
    function refresh() {
        if (root.refreshing) return            // single-flight
        root.refreshing = true
        root.core("listCalendars", [], function (rc) {
            var cs = root.j(rc, null)
            root.core("listAllEvents", [], function (re) {
                var es = root.j(re, null)
                root.refreshing = false
                root.loading = false
                if (!Array.isArray(cs) || !Array.isArray(es)) {
                    root.loadError = root.hasBridge() ? "Couldn't read your calendars from Scala. Is the ‘scala’ package installed?" : "No Basecamp bridge."
                    return
                }
                root.loadError = ""
                root.calendars = cs
                root.events = es
                if (root.selected) {
                    var still = root.eventById(root.selected.id)
                    if (!still) root.selected = null
                }
            })
        })
    }
    Timer { interval: 10000; running: root.ready; repeat: true; onTriggered: root.refresh() }
    Component.onCompleted: Qt.callLater(function () {
        root.ready = root.hasBridge()
        root.core("coreVersion", [], function (r) { root.coreVer = String(root.j(r, "") || "") })
        root.refresh()
    })

    function calById(id) { for (var i = 0; i < calendars.length; i++) if (calendars[i].id === id) return calendars[i]; return null }
    function eventById(id) { for (var i = 0; i < events.length; i++) if (events[i].id === id) return events[i]; return null }
    // A calendar is a Frequencies calendar when its `status` field is the Frequencies one: a choice
    // field offering Hold, Confirmed and Cancelled. A `status` field of another shape belongs to
    // someone else's convention and is left alone.
    function statusFieldOf(c) {
        var sc = (c && c.schema) || []
        for (var i = 0; i < sc.length; i++) if (sc[i] && sc[i].key === "status") return sc[i]
        return null
    }
    function isFreqStatusField(f) {
        if (!f || f.type !== "enum" || !Array.isArray(f.options)) return false
        for (var i = 0; i < root.statuses.length; i++) if (f.options.indexOf(root.statuses[i]) < 0) return false
        return true
    }
    function isFreqCal(c) { return isFreqStatusField(statusFieldOf(c)) }
    // Why "Use for Frequencies" can't adopt this calendar ("" = it can).
    function adoptBlocker(c) {
        if (!isEditorOf(c)) return "Only its owner or editors can add Frequencies fields"
        var sf = statusFieldOf(c)
        if (sf && !isFreqStatusField(sf)) return "Has its own “status” field, so Frequencies leaves it alone"
        var sc = (c && c.schema) || []
        for (var i = 0; i < sc.length; i++) {
            var f = sc[i]
            if (f && f.key === "venue" && f.type && f.type !== "text") return "Has its own “venue” field of another kind"
            if (f && f.key === "type" && f.type && f.type !== "enum") return "Has its own “type” field of another kind"
        }
        return ""
    }
    readonly property var freqCals: { var o = []; for (var i = 0; i < calendars.length; i++) if (isFreqCal(calendars[i])) o.push(calendars[i]); return o }
    readonly property var otherCals: { var o = []; for (var i = 0; i < calendars.length; i++) if (!isFreqCal(calendars[i])) o.push(calendars[i]); return o }
    property var hiddenCals: ({})
    function toggleCal(id) { var h = {}; for (var k in hiddenCals) h[k] = hiddenCals[k]; if (h[id]) delete h[id]; else h[id] = true; hiddenCals = h }
    // Only owners/editors may change a calendar's fields.
    function isEditorOf(c) {
        if (!c) return false
        var me = c.authorAddr || ""
        if (!me) return false
        if (c.owner === me) return true
        var r = c.roles || {}
        return r[me] === "editor" || r[me] === "admin"
    }

    // "Use for Frequencies": add the Status / Venue / Type fields to a calendar's schema (keeps its own fields).
    function adoptCalendar(c) {
        var why = adoptBlocker(c)
        if (why) { root.notify(why + ".", true); return }
        var sc = (c.schema || []).slice()
        for (var i = 0; i < root.freqFields.length; i++) {
            var f = root.freqFields[i], have = false
            for (var k = 0; k < sc.length; k++) if (sc[k] && sc[k].key === f.key) have = true
            if (!have) sc.push(f)
        }
        root.core("updateCalendarMeta", [c.id, JSON.stringify({ schema: sc })], function (r) {
            if (root.j(r, false) === true || String(r) === "true") { root.notify("“" + (c.name || "Calendar") + "” now uses Frequencies fields"); root.refresh() }
            else root.notify("Couldn't update “" + (c.name || "the calendar") + "”. Only its owner or editors can change its fields.", true)
        })
    }

    // ── recurrence expansion (identical to Scala's) ──────────────────────────────
    function expandEvent(ev, winStart, winEnd) {
        var dur = Math.max(0, (ev.endTime || ev.startTime) - ev.startTime)
        var r = ev.recur
        function mk(s) { var o = {}; for (var k in ev) o[k] = ev[k]; o.startTime = s; o.endTime = s + dur; o.seriesId = ev.id; o.occ = s; return o }
        if (!r || !r.freq) return (ev.startTime + dur >= winStart && ev.startTime <= winEnd) ? [mk(ev.startTime)] : []
        var interval = Math.max(1, Math.floor(r.interval || 1))
        var hardUntil = (typeof r.until === "number") ? r.until : Infinity
        var out = [], cur = new Date(ev.startTime)
        for (var i = 0; i < 500; i++) {
            var s = cur.getTime()
            if (s > hardUntil || s > winEnd) break
            if (s + dur >= winStart) out.push(mk(s))
            if (r.freq === "daily") cur.setDate(cur.getDate() + interval)
            else if (r.freq === "weekly") cur.setDate(cur.getDate() + 7 * interval)
            else if (r.freq === "monthly") cur.setMonth(cur.getMonth() + interval)
            else if (r.freq === "yearly") cur.setFullYear(cur.getFullYear() + interval)
            else break
        }
        return out
    }
    function expandEvents(evs, winStart, winEnd) {
        var out = []
        for (var i = 0; i < evs.length; i++) { var xs = expandEvent(evs[i], winStart, winEnd); for (var k = 0; k < xs.length; k++) out.push(xs[k]) }
        out.sort(function (a, b) { return a.startTime - b.startTime })
        return out
    }

    // ── lanes (prototypes/lanes/lanes.ts) ────────────────────────────────────────
    property date firstDay: { var d = new Date(); d.setHours(0, 0, 0, 0); return d }
    readonly property int nDays: 14
    property string laneBy: "venue"          // "venue" | "status" | "calendar"
    function laneOf(o) {
        if (laneBy === "calendar") return o.calendarId
        var v = fieldOf(o, laneBy)
        return v === "" ? "—" : v
    }
    function buildLanes(occs, cals) {
        var lanes = [], index = {}
        function addLane(id, label) { if (index[id] === undefined) { index[id] = lanes.length; lanes.push({ id: id, label: label }) } }
        if (laneBy === "calendar") { for (var i = 0; i < cals.length; i++) addLane(cals[i].id, cals[i].name || "(unnamed)") }
        else if (laneBy === "status") { for (var s = 0; s < statuses.length; s++) addLane(statuses[s], statuses[s]) }
        var d0 = new Date(firstDay).getTime()
        function dayStart(n) { var d = new Date(d0); d.setDate(d.getDate() + n); return d.getTime() }
        var end = dayStart(nDays), inWin = []
        for (var a = 0; a < occs.length; a++) if (occs[a].startTime >= d0 && occs[a].startTime < end) inWin.push(occs[a])
        var noValue = false
        for (var b = 0; b < inWin.length; b++) { var id = laneOf(inWin[b]); if (id === "—") { noValue = true; continue } addLane(id, id) }
        if (noValue) addLane("—", laneBy === "venue" ? "No venue" : "—")
        var days = []
        for (var c = 0; c < nDays; c++) { var cells = []; for (var e = 0; e < lanes.length; e++) cells.push([]); days.push({ date: dayStart(c), cells: cells }) }
        for (var g = 0; g < inWin.length; g++) {
            var dd = new Date(inWin[g].startTime); dd.setHours(0, 0, 0, 0)
            var row = -1
            for (var r = 0; r < days.length; r++) if (days[r].date === dd.getTime()) { row = r; break }
            var col = index[laneOf(inWin[g])]
            if (row >= 0 && col !== undefined) days[row].cells[col].push(inWin[g])
        }
        return { lanes: lanes, days: days }
    }
    readonly property var shownCals: { var o = []; for (var i = 0; i < freqCals.length; i++) if (!hiddenCals[freqCals[i].id]) o.push(freqCals[i]); return o }
    readonly property var grid: {
        var ids = {}
        for (var i = 0; i < shownCals.length; i++) ids[shownCals[i].id] = true
        var src = []
        for (var k = 0; k < events.length; k++) if (ids[events[k].calendarId]) src.push(events[k])
        var d0 = new Date(firstDay).getTime()
        return buildLanes(expandEvents(src, d0, d0 + (nDays + 1) * 864e5), shownCals)
    }
    function shiftDays(n) { var d = new Date(firstDay); d.setDate(d.getDate() + n); firstDay = d }
    function rangeLabel() {
        var a = new Date(firstDay), b = new Date(firstDay); b.setDate(b.getDate() + nDays - 1)
        return Qt.formatDate(a, "d MMM") + " – " + Qt.formatDate(b, "d MMM yyyy")
    }

    // ── the selected night (right panel) ─────────────────────────────────────────
    property var selected: null              // an occurrence
    readonly property var selMaster: selected ? (eventById(selected.seriesId || selected.id) || selected) : null
    readonly property var selCal: selMaster ? calById(selMaster.calendarId) : null
    function canEdit(ev) {
        var c = ev ? calById(ev.calendarId) : null
        if (!c) return false
        var me = c.authorAddr || ""
        if (isEditorOf(c)) return true
        var r = (c.roles || {})[me]
        if (r === "viewer") return false
        return c.collab === true || (!!ev.creatorId && ev.creatorId === me)
    }
    // Change one Frequencies field on the night (status / venue / type) — a normal Scala edit.
    property bool saving: false
    // Scala replaces a whole event on every edit (last write wins per event), so the edit is built on
    // the freshest copy, fetched right before saving: a title or time someone changed since the board
    // last refreshed is kept, not overwritten with the board's older copy.
    function setField(key, value) {
        var m = selMaster
        if (!m || saving) return
        saving = true
        root.core("getEvent", [m.id], function (raw) {
            var fresh = root.j(raw, null)
            if (!fresh || typeof fresh !== "object" || fresh.id !== m.id) {
                saving = false
                root.notify("Couldn't load the night to change it. It may have been deleted.", true)
                root.refresh()
                return
            }
            var up = JSON.parse(JSON.stringify(fresh))
            delete up.seriesId; delete up.occ; delete up.ext; delete up.rsvps
            if (!up.calendarId) up.calendarId = m.calendarId
            up.fields = (up.fields && typeof up.fields === "object") ? up.fields : {}
            up.fields[key] = value
            root.core("updateEvent", [JSON.stringify(up)], function (r) {
                saving = false
                if (String(root.j(r, "")) === m.id) { root.notify("Saved"); root.refresh() }
                else root.notify("Couldn't save the change. You may not have edit rights on this calendar.", true)
            })
        })
    }
    function commentsOf(ev) {
        var out = [], xs = (ev && ev.ext) || []
        for (var i = 0; i < xs.length; i++) if (xs[i].ns === "scala" && xs[i].kind === "comment") out.push(xs[i])
        return out
    }
    property bool commentBusy: false
    function postComment(text) {
        text = String(text || "").trim()
        if (!text || commentBusy || !selMaster) return
        commentBusy = true
        var item = { ns: "scala", kind: "comment", target: selMaster.id, data: { text: text } }
        root.core("postExt", [selMaster.calendarId, JSON.stringify(item)], function (r) {
            commentBusy = false
            var res = root.j(r, {})
            if (res && res.ok) { commentInput.text = ""; root.refresh() }
            else root.notify("Couldn't post the comment" + (res && res.error ? ": " + res.error : ". Update the ‘scala’ package to 0.12.0+."), true)
        })
    }
    function deleteComment(id) {
        root.core("deleteExt", [selMaster.calendarId, id], function (r) {
            var res = root.j(r, {})
            if (res && res.ok) root.refresh(); else root.notify("Couldn't delete the comment.", true)
        })
    }
    function rsvpSummary(ev) {
        var n = { going: 0, maybe: 0, no: 0 }, r = (ev && ev.rsvps) || {}
        for (var k in r) if (n[r[k]] !== undefined) n[r[k]]++
        return n.going + " going · " + n.maybe + " maybe · " + n.no + " no"
    }

    // ── toast ────────────────────────────────────────────────────────────────────
    property string toastMsg: ""
    property bool toastErr: false
    function notify(msg, isErr) { toastMsg = msg; toastErr = !!isErr; toastTimer.restart() }
    Timer { id: toastTimer; interval: 4000; onTriggered: root.toastMsg = "" }

    // ── small components ─────────────────────────────────────────────────────────
    component Chip: Rectangle {
        id: chip
        property string text: ""
        property bool on: false
        property color accent: root.cBlue
        signal clicked()
        height: 26; radius: 13; width: chipT.implicitWidth + 22
        color: on ? root.cSurface : "transparent"; border.width: 1; border.color: on ? accent : root.cSurface2
        LogosText { id: chipT; textFormat: Text.PlainText; anchors.centerIn: parent; text: chip.text; color: chip.on ? chip.accent : root.cSub; font.pixelSize: 12 }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: chip.clicked() }
    }
    // Text input styled with the tokens (the DS TextField would otherwise be light on light).
    component Input: TextField {
        color: root.cText; font.pixelSize: 13
        placeholderTextColor: root.cFaint
        leftPadding: 10; rightPadding: 10; topPadding: 8; bottomPadding: 8
        background: Rectangle { radius: 8; color: root.cBase; border.width: 1; border.color: parent.activeFocus ? root.cMauve : root.cSurface2 }
    }
    component Btn: Rectangle {
        id: btn
        property string text: ""
        property bool primary: false
        property bool enabled_: true
        signal clicked()
        height: 32; radius: 8; width: btnT.implicitWidth + 24
        opacity: enabled_ ? 1 : 0.4
        color: primary ? root.cMauve : (btnMA.containsMouse ? root.cSurface2 : root.cSurface)
        LogosText { id: btnT; textFormat: Text.PlainText; anchors.centerIn: parent; text: btn.text; color: btn.primary ? root.cCrust : root.cText; font.pixelSize: 13; font.weight: Theme.typography.weightMedium }
        MouseArea { id: btnMA; anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: if (btn.enabled_) btn.clicked() }
    }

    Rectangle { anchors.fill: parent; color: root.cBase }

    RowLayout {
        anchors.fill: parent; spacing: 0

        // ── sidebar: calendars ─────────────────────────────────────────────────
        Rectangle {
            Layout.fillHeight: true; Layout.preferredWidth: 210; color: root.cMantle
            Flickable {
                id: sideFlick
                anchors.fill: parent; anchors.margins: 14; clip: true
                contentWidth: width; contentHeight: sideCol.implicitHeight
                boundsBehavior: Flickable.StopAtBounds
                ScrollBar.vertical: ScrollBar {}
            ColumnLayout {
                id: sideCol
                width: sideFlick.width; spacing: 8
                LogosText { textFormat: Text.PlainText; text: "Frequencies"; color: root.cText; font.pixelSize: 20; font.weight: Theme.typography.weightMedium }
                LogosText { textFormat: Text.PlainText; text: "Calendars"; color: root.cFaint; font.pixelSize: 11; Layout.topMargin: 8 }
                LogosText { textFormat: Text.PlainText; visible: !root.loading && root.freqCals.length === 0; Layout.fillWidth: true; wrapMode: Text.Wrap; color: root.cSub; font.pixelSize: 12
                    text: "None yet. Pick a Scala calendar below and choose “Use for Frequencies”, or create one in Scala first." }
                Repeater {
                    model: root.freqCals
                    delegate: RowLayout {
                        required property var modelData
                        Layout.fillWidth: true; spacing: 8
                        Rectangle {
                            width: 12; height: 12; radius: 6
                            color: root.hiddenCals[modelData.id] ? "transparent" : root.cMauve
                            border.width: root.hiddenCals[modelData.id] ? 2 : 0; border.color: root.cSub
                            MouseArea { anchors.fill: parent; anchors.margins: -4; cursorShape: Qt.PointingHandCursor; onClicked: root.toggleCal(parent.parent.modelData.id) }
                        }
                        LogosText { textFormat: Text.PlainText; text: modelData.name || "(unnamed)"; color: root.hiddenCals[modelData.id] ? root.cSub : root.cText; font.pixelSize: 14; elide: Text.ElideRight; Layout.fillWidth: true }
                    }
                }
                LogosText { textFormat: Text.PlainText; visible: root.otherCals.length > 0; text: "Other Scala calendars"; color: root.cFaint; font.pixelSize: 11; Layout.topMargin: 12 }
                Repeater {
                    model: root.otherCals
                    delegate: ColumnLayout {
                        required property var modelData
                        Layout.fillWidth: true; spacing: 2
                        LogosText { textFormat: Text.PlainText; text: modelData.name || "(unnamed)"; color: root.cSub; font.pixelSize: 13; elide: Text.ElideRight; Layout.fillWidth: true }
                        LogosText { textFormat: Text.PlainText
                            readonly property string why: root.adoptBlocker(parent.modelData)
                            text: why === "" ? "Use for Frequencies" : why
                            color: why === "" ? root.cBlue : root.cFaint; font.pixelSize: 12; Layout.fillWidth: true; wrapMode: Text.Wrap
                            MouseArea { anchors.fill: parent; enabled: parent.why === ""; cursorShape: Qt.PointingHandCursor; onClicked: root.adoptCalendar(parent.parent.modelData) }
                        }
                    }
                }
                Item { Layout.preferredHeight: 12 }
                LogosText { textFormat: Text.PlainText; Layout.fillWidth: true; wrapMode: Text.Wrap; color: root.cFaint; font.pixelSize: 11
                    text: "Nights are Scala events: they also show in Scala, and comments are shared." }
            }
            }
        }

        // ── board: lanes ───────────────────────────────────────────────────────
        ColumnLayout {
            Layout.fillWidth: true; Layout.fillHeight: true; Layout.margins: 14; spacing: 10
            RowLayout {
                Layout.fillWidth: true; spacing: 8
                Btn { text: "‹"; onClicked: root.shiftDays(-7) }
                Btn { text: "Today"; onClicked: { var d = new Date(); d.setHours(0, 0, 0, 0); root.firstDay = d } }
                Btn { text: "›"; onClicked: root.shiftDays(7) }
                LogosText { textFormat: Text.PlainText; text: root.rangeLabel(); color: root.cText; font.pixelSize: 18; font.weight: Theme.typography.weightMedium; Layout.leftMargin: 6 }
                Item { Layout.fillWidth: true }
                Btn { text: "+ New night"; primary: true; enabled_: root.freqCals.length > 0; onClicked: root.openNew() }
            }
            RowLayout {
                spacing: 6
                LogosText { textFormat: Text.PlainText; text: "Columns:"; color: root.cFaint; font.pixelSize: 12 }
                Chip { text: "By venue"; on: root.laneBy === "venue"; onClicked: root.laneBy = "venue" }
                Chip { text: "By status"; on: root.laneBy === "status"; onClicked: root.laneBy = "status" }
                Chip { text: "By calendar"; on: root.laneBy === "calendar"; onClicked: root.laneBy = "calendar" }
                LogosText { textFormat: Text.PlainText; text: "Double-click an empty cell to add a night there"; color: root.cFaint; font.pixelSize: 11; Layout.leftMargin: 10 }
            }
            LogosText { textFormat: Text.PlainText; visible: root.loadError !== ""; text: root.loadError; color: root.cRed; font.pixelSize: 13; Layout.fillWidth: true; wrapMode: Text.Wrap }
            LogosText { textFormat: Text.PlainText; visible: !root.loading && root.loadError === "" && root.grid.lanes.length === 0
                text: root.freqCals.length ? "No nights in these two weeks. Add one with “+ New night”." : "Set up a calendar on the left to start."
                color: root.cSub; font.pixelSize: 14 }

            Flickable {
                id: boardFlick
                Layout.fillWidth: true; Layout.fillHeight: true; clip: true
                contentWidth: board.width; contentHeight: board.height
                ScrollBar.vertical: ScrollBar {}
                ScrollBar.horizontal: ScrollBar {}
                Column {
                    id: board
                    readonly property int dateW: 64
                    readonly property int cellW: 150
                    Row {
                        Item { width: board.dateW; height: 30 }
                        Repeater {
                            model: root.grid.lanes
                            delegate: Item {
                                required property var modelData
                                width: board.cellW; height: 30
                                Rectangle { visible: root.laneBy === "status"; width: 10; height: 10; radius: 5; x: 6; anchors.verticalCenter: parent.verticalCenter; color: root.statusColor(parent.modelData.id) }
                                LogosText { textFormat: Text.PlainText; text: parent.modelData.label; color: root.cText; font.pixelSize: 13; font.weight: Theme.typography.weightMedium
                                    elide: Text.ElideRight; x: root.laneBy === "status" ? 22 : 6; width: board.cellW - x - 6; anchors.verticalCenter: parent.verticalCenter }
                            }
                        }
                    }
                    Repeater {
                        model: root.grid.days
                        delegate: Row {
                            id: dayRow
                            required property var modelData
                            readonly property bool isToday: new Date(modelData.date).toDateString() === new Date().toDateString()
                            readonly property bool weekend: { var g = new Date(modelData.date).getDay(); return g === 5 || g === 6 }
                            Rectangle {
                                width: board.dateW; height: cellsRow.height
                                color: dayRow.weekend ? root.cMantle : "transparent"
                                Column {
                                    anchors.verticalCenter: parent.verticalCenter; x: 6
                                    LogosText { textFormat: Text.PlainText; text: Qt.formatDate(new Date(dayRow.modelData.date), "ddd"); color: dayRow.isToday ? root.cYellow : root.cSub; font.pixelSize: 12 }
                                    LogosText { textFormat: Text.PlainText; text: Qt.formatDate(new Date(dayRow.modelData.date), "d MMM"); color: dayRow.isToday ? root.cYellow : root.cSub; font.pixelSize: 12 }
                                }
                            }
                            Row {
                                id: cellsRow
                                Repeater {
                                    model: dayRow.modelData.cells
                                    delegate: Rectangle {
                                        id: cell
                                        required property var modelData
                                        required property int index
                                        width: board.cellW; height: Math.max(48, cellCol.implicitHeight + 8)
                                        color: dayRow.weekend ? root.cMantle : "transparent"; border.width: 1; border.color: root.cSurface2
                                        Column {
                                            id: cellCol
                                            x: 4; y: 4; width: board.cellW - 8; spacing: 4
                                            Repeater {
                                                model: cell.modelData
                                                delegate: Rectangle {
                                                    id: night
                                                    required property var modelData
                                                    readonly property string status: root.fieldOf(modelData, "status")
                                                    readonly property bool isSel: !!root.selected && root.selected.id === modelData.id && root.selected.occ === modelData.occ
                                                    width: cellCol.width; height: 46; radius: 6
                                                    color: isSel ? root.cSurface2 : root.cSurface
                                                    border.width: isSel ? 1 : 0; border.color: root.cMauve
                                                    Rectangle { width: 4; height: parent.height; radius: 2; color: root.statusColor(night.status) }
                                                    Column {
                                                        x: 10; anchors.verticalCenter: parent.verticalCenter; width: parent.width - 14; spacing: 1
                                                        LogosText { textFormat: Text.PlainText; width: parent.width; elide: Text.ElideRight; font.pixelSize: 12; color: root.cText
                                                            font.strikeout: night.status === "Cancelled"
                                                            text: night.modelData.title || "(untitled)" }
                                                        LogosText { textFormat: Text.PlainText; width: parent.width; elide: Text.ElideRight; font.pixelSize: 11; color: root.cSub
                                                            text: (night.modelData.allDay ? "All day" : Qt.formatTime(new Date(night.modelData.startTime), "hh:mm"))
                                                                + (root.laneBy !== "venue" && root.fieldOf(night.modelData, "venue") ? " · " + root.fieldOf(night.modelData, "venue") : "")
                                                                + (night.status && root.laneBy !== "status" ? " · " + night.status : "") }
                                                    }
                                                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.selected = night.modelData }
                                                }
                                            }
                                        }
                                        MouseArea {
                                            anchors.fill: parent; z: -1; cursorShape: Qt.PointingHandCursor
                                            // Double-click an empty spot: a new night on that day (and in that venue's column).
                                            onDoubleClicked: root.openNew(new Date(dayRow.modelData.date), root.laneBy === "venue" && root.grid.lanes[cell.index] ? root.grid.lanes[cell.index].id : "")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── night panel ───────────────────────────────────────────────────────
        Rectangle {
            visible: root.selMaster !== null
            Layout.fillHeight: true; Layout.preferredWidth: 310; color: root.cMantle
            Flickable {
                id: panelFlick
                anchors.fill: parent; anchors.margins: 14; clip: true
                contentWidth: width; contentHeight: panelCol.implicitHeight
                ScrollBar.vertical: ScrollBar {}
                ColumnLayout {
                    id: panelCol
                    width: panelFlick.width; spacing: 8
                    RowLayout {
                        Layout.fillWidth: true
                        LogosText { textFormat: Text.PlainText; text: root.selMaster ? (root.selMaster.title || "(untitled)") : ""; color: root.cText; font.pixelSize: 18; font.weight: Theme.typography.weightMedium; wrapMode: Text.Wrap; Layout.fillWidth: true }
                        LogosText { textFormat: Text.PlainText; text: "✕"; color: root.cSub; font.pixelSize: 15
                            MouseArea { anchors.fill: parent; anchors.margins: -6; cursorShape: Qt.PointingHandCursor; onClicked: root.selected = null } }
                    }
                    LogosText { textFormat: Text.PlainText; Layout.fillWidth: true; wrapMode: Text.Wrap; color: root.cSub; font.pixelSize: 13
                        text: root.selected ? (Qt.formatDateTime(new Date(root.selected.startTime), "dddd d MMMM, hh:mm") + "–" + Qt.formatTime(new Date(root.selected.endTime), "hh:mm")
                            + (root.selCal ? "  ·  " + (root.selCal.name || "") : "")) : "" }
                    LogosText { textFormat: Text.PlainText; visible: !!root.selMaster && !root.canEdit(root.selMaster); Layout.fillWidth: true; wrapMode: Text.Wrap; color: root.cFaint; font.pixelSize: 12
                        text: "Read-only: you can't edit this night on this calendar." }

                    LogosText { textFormat: Text.PlainText; text: "Status"; color: root.cFaint; font.pixelSize: 11; Layout.topMargin: 6 }
                    Flow {
                        Layout.fillWidth: true; spacing: 6
                        Repeater {
                            model: root.statuses
                            delegate: Chip {
                                required property var modelData
                                text: modelData; accent: root.statusColor(modelData)
                                on: root.fieldOf(root.selMaster, "status") === modelData
                                opacity: root.canEdit(root.selMaster) ? 1 : 0.5
                                onClicked: if (root.canEdit(root.selMaster) && !on) root.setField("status", modelData)
                            }
                        }
                    }
                    LogosText { textFormat: Text.PlainText; text: "Venue"; color: root.cFaint; font.pixelSize: 11; Layout.topMargin: 6 }
                    RowLayout {
                        Layout.fillWidth: true; spacing: 6
                        Input {
                            id: venueInput
                            Layout.fillWidth: true; color: root.cText; font.pixelSize: 13
                            enabled: root.canEdit(root.selMaster)
                            text: root.fieldOf(root.selMaster, "venue")
                            placeholderText: "Where it happens"
                            onAccepted: root.setField("venue", text.trim())
                        }
                        Btn { text: "Save"; enabled_: root.canEdit(root.selMaster) && venueInput.text.trim() !== root.fieldOf(root.selMaster, "venue"); onClicked: root.setField("venue", venueInput.text.trim()) }
                    }
                    LogosText { textFormat: Text.PlainText; text: "Type"; color: root.cFaint; font.pixelSize: 11; Layout.topMargin: 6 }
                    Flow {
                        Layout.fillWidth: true; spacing: 6
                        Repeater {
                            model: root.types
                            delegate: Chip {
                                required property var modelData
                                text: modelData; on: root.fieldOf(root.selMaster, "type") === modelData
                                opacity: root.canEdit(root.selMaster) ? 1 : 0.5
                                onClicked: if (root.canEdit(root.selMaster) && !on) root.setField("type", modelData)
                            }
                        }
                    }
                    LogosText { textFormat: Text.PlainText; visible: !!root.selMaster && !!root.selMaster.description; text: "Notes"; color: root.cFaint; font.pixelSize: 11; Layout.topMargin: 6 }
                    LogosText { textFormat: Text.PlainText; visible: !!root.selMaster && !!root.selMaster.description; text: root.selMaster ? (root.selMaster.description || "") : ""; color: root.cText; font.pixelSize: 13; wrapMode: Text.Wrap; Layout.fillWidth: true }
                    LogosText { textFormat: Text.PlainText; text: "Attendance: " + root.rsvpSummary(root.selMaster); color: root.cSub; font.pixelSize: 12; Layout.topMargin: 6 }

                    // Comments: Scala's ext items, so the same thread shows in Scala.
                    LogosText { textFormat: Text.PlainText; text: "Comments (" + root.commentsOf(root.selMaster).length + ")"; color: root.cFaint; font.pixelSize: 11; Layout.topMargin: 10 }
                    Repeater {
                        model: root.commentsOf(root.selMaster)
                        delegate: ColumnLayout {
                            required property var modelData
                            readonly property bool mine: !!root.selCal && modelData.author === root.selCal.authorAddr
                            Layout.fillWidth: true; spacing: 2
                            RowLayout {
                                Layout.fillWidth: true
                                LogosText { textFormat: Text.PlainText; Layout.fillWidth: true; elide: Text.ElideRight; color: root.cSub; font.pixelSize: 11
                                    text: (parent.parent.mine ? "You" : String(parent.parent.modelData.author).substring(0, 8) + "…") + " · " + Qt.formatDateTime(new Date(parent.parent.modelData.hlc.wall), "d MMM hh:mm") }
                                LogosText { textFormat: Text.PlainText; visible: parent.parent.mine || root.isEditorOf(root.selCal); text: "Delete"; color: root.cRed; font.pixelSize: 11
                                    MouseArea { anchors.fill: parent; anchors.margins: -4; cursorShape: Qt.PointingHandCursor; onClicked: root.deleteComment(parent.parent.parent.modelData.id) } }
                            }
                            LogosText { textFormat: Text.PlainText; Layout.fillWidth: true; wrapMode: Text.Wrap; color: root.cText; font.pixelSize: 13
                                text: (parent.modelData.data && typeof parent.modelData.data.text === "string") ? parent.modelData.data.text : "(empty)" }
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true; spacing: 6
                        Input { id: commentInput; Layout.fillWidth: true; placeholderText: "Add a comment…"; color: root.cText; font.pixelSize: 13; onAccepted: root.postComment(text) }
                        Btn { text: root.commentBusy ? "Posting…" : "Post"; enabled_: commentInput.text.trim() !== "" && !root.commentBusy; onClicked: root.postComment(commentInput.text) }
                    }
                }
            }
        }
    }

    // ── new night ────────────────────────────────────────────────────────────────
    property string newCalId: ""
    property string newStatus: "Hold"
    function pad(n) { return (n < 10 ? "0" : "") + n }
    function openNew(day, venue) {
        if (freqCals.length === 0) return
        var d = day ? new Date(day) : new Date(firstDay)
        newCalId = newCalId && calById(newCalId) && isFreqCal(calById(newCalId)) ? newCalId : freqCals[0].id
        newStatus = "Hold"
        nTitle.text = ""; nVenue.text = venue && venue !== "—" ? venue : ""
        nDate.text = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
        nStart.text = "22:00"; nEnd.text = "04:00"
        newPopup.open()
        nTitle.forceActiveFocus()
    }
    function parseLocal(dateStr, timeStr) {
        var dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim()), tm = /^(\d{1,2}):(\d{2})$/.exec(String(timeStr).trim())
        if (!dm || !tm) return null
        return new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2], 0, 0)
    }
    property bool creating: false
    function createNight() {
        if (creating) return
        var title = nTitle.text.trim()
        var s = parseLocal(nDate.text, nStart.text), e = parseLocal(nDate.text, nEnd.text)
        if (!title) { notify("Give the night a name.", true); return }
        if (!s || !e) { notify("Use a date like 2026-10-24 and times like 22:00.", true); return }
        if (e.getTime() <= s.getTime()) e = new Date(e.getTime() + 864e5)   // ends after midnight
        var ev = { title: title, startTime: s.getTime(), endTime: e.getTime(), reminderMin: 60,
                   fields: { status: newStatus, venue: nVenue.text.trim(), type: "Club night" } }
        creating = true
        core("createEvent", [newCalId, JSON.stringify(ev)], function (r) {
            creating = false
            var id = String(j(r, "") || "")
            if (id) { newPopup.close(); notify("Added “" + title + "”"); refresh() }
            else notify("Couldn't add the night. You may not be allowed to add events to this calendar.", true)
        })
    }
    Popup {
        id: newPopup
        anchors.centerIn: Overlay.overlay
        width: 420; modal: true; padding: 20
        background: Rectangle { radius: 12; color: root.cSurface; border.width: 1; border.color: root.cSurface2 }
        ColumnLayout {
            anchors.fill: parent; spacing: 8
            LogosText { textFormat: Text.PlainText; text: "New night"; color: root.cText; font.pixelSize: 18; font.weight: Theme.typography.weightMedium }
            LogosText { textFormat: Text.PlainText; text: "Calendar"; color: root.cFaint; font.pixelSize: 11 }
            Flow {
                Layout.fillWidth: true; spacing: 6
                Repeater {
                    model: root.freqCals
                    delegate: Chip { required property var modelData; text: modelData.name || "(unnamed)"; on: root.newCalId === modelData.id; onClicked: root.newCalId = modelData.id }
                }
            }
            LogosText { textFormat: Text.PlainText; text: "Name"; color: root.cFaint; font.pixelSize: 11 }
            Input { id: nTitle; Layout.fillWidth: true; placeholderText: "e.g. Bassline Fridays"; color: root.cText; font.pixelSize: 13 }
            RowLayout {
                Layout.fillWidth: true; spacing: 8
                ColumnLayout { Layout.fillWidth: true; spacing: 4
                    LogosText { textFormat: Text.PlainText; text: "Date"; color: root.cFaint; font.pixelSize: 11 }
                    Input { id: nDate; Layout.fillWidth: true; color: root.cText; font.pixelSize: 13 } }
                ColumnLayout { spacing: 4
                    LogosText { textFormat: Text.PlainText; text: "Doors"; color: root.cFaint; font.pixelSize: 11 }
                    Input { id: nStart; Layout.preferredWidth: 70; color: root.cText; font.pixelSize: 13 } }
                ColumnLayout { spacing: 4
                    LogosText { textFormat: Text.PlainText; text: "Ends"; color: root.cFaint; font.pixelSize: 11 }
                    Input { id: nEnd; Layout.preferredWidth: 70; color: root.cText; font.pixelSize: 13 } }
            }
            LogosText { textFormat: Text.PlainText; text: "Venue"; color: root.cFaint; font.pixelSize: 11 }
            Input { id: nVenue; Layout.fillWidth: true; placeholderText: "Where it happens"; color: root.cText; font.pixelSize: 13 }
            LogosText { textFormat: Text.PlainText; text: "Status"; color: root.cFaint; font.pixelSize: 11 }
            Flow {
                Layout.fillWidth: true; spacing: 6
                Repeater {
                    model: root.statuses
                    delegate: Chip { required property var modelData; text: modelData; accent: root.statusColor(modelData); on: root.newStatus === modelData; onClicked: root.newStatus = modelData }
                }
            }
            RowLayout {
                Layout.fillWidth: true; Layout.topMargin: 8; spacing: 8
                Item { Layout.fillWidth: true }
                Btn { text: "Cancel"; onClicked: newPopup.close() }
                Btn { text: root.creating ? "Adding…" : "Add night"; primary: true; enabled_: !root.creating; onClicked: root.createNight() }
            }
        }
    }

    // ── toast ────────────────────────────────────────────────────────────────────
    Rectangle {
        visible: root.toastMsg !== ""
        anchors.bottom: parent.bottom; anchors.horizontalCenter: parent.horizontalCenter; anchors.bottomMargin: 20
        width: Math.min(parent.width - 40, toastT.implicitWidth + 32); height: toastT.implicitHeight + 18; radius: 10
        color: root.toastErr ? "#4a2530" : root.cSurface2
        LogosText { id: toastT; textFormat: Text.PlainText; anchors.centerIn: parent; width: Math.min(implicitWidth, root.width - 72); wrapMode: Text.Wrap
            text: root.toastMsg; color: root.toastErr ? root.cRed : root.cText; font.pixelSize: 13 }
    }
}
