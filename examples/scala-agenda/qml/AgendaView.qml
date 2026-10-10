// Scala Agenda: an example Basecamp view that builds on Scala.
//
// It lists the next 7 days of events from every Scala calendar on this machine and lets you add
// a comment to one. All of it goes through the `scala` core module, so the events and comments
// are Scala's own: they sync to everyone in the calendar and show up in the Scala app too.
// See ../../docs/integration-guide.md for the rules this follows.
//
// The three habits worth copying:
//   1. every module call is asynchronous (callModuleAsync), the UI never waits on it;
//   2. results are JSON strings, sometimes encoded twice: unwrap until it isn't a string (j());
//   3. everything other people wrote is shown as plain text and read with a type check.
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

import Logos.Theme
import Logos.Controls

Item {
    id: root
    width: 720
    height: 640

    // ── calling the scala core ───────────────────────────────────────────────
    function call(method, args, cb) {
        if (typeof logos === "undefined" || !logos || typeof logos.callModuleAsync !== "function") {
            Qt.callLater(function () { cb("") }); return
        }
        logos.callModuleAsync("scala", method, args || [], function (res) { cb(res === undefined || res === null ? "" : res) }, 20000)
    }
    function j(raw, fallback) {
        var v = raw
        for (var i = 0; i < 3 && typeof v === "string"; i++) {
            if (v.trim() === "") return fallback
            try { v = JSON.parse(v) } catch (e) { return i === 0 ? fallback : v }
        }
        return (v === undefined || v === null) ? fallback : v
    }
    function str(v) { return typeof v === "string" ? v : "" }

    // ── data ─────────────────────────────────────────────────────────────────
    property var calendars: ({})     // id -> name
    property var upcoming: []        // events in the next 7 days, sorted
    property string status: "Loading…"
    property var selected: null

    function refresh() {
        call("listCalendars", [], function (rc) {
            var cs = j(rc, []), names = {}
            if (Array.isArray(cs)) for (var i = 0; i < cs.length; i++) if (cs[i] && str(cs[i].id)) names[cs[i].id] = str(cs[i].name) || "(unnamed)"
            calendars = names
            call("listAllEvents", [], function (re) {
                var es = j(re, null)
                if (!Array.isArray(es)) { status = "Couldn't read Scala. Is the ‘scala’ package installed?"; return }
                var now = Date.now(), end = now + 7 * 864e5, out = []
                for (var k = 0; k < es.length; k++) {
                    var e = es[k]
                    if (!e || typeof e.startTime !== "number" || e.startTime < now - 3600e3 || e.startTime > end) continue
                    out.push(e)   // (recurring events: expand them as Scala does; left out to keep this short)
                }
                out.sort(function (a, b) { return a.startTime - b.startTime })
                upcoming = out
                status = out.length ? "" : "Nothing in the next 7 days."
                if (selected) { var still = null; for (var m = 0; m < out.length; m++) if (out[m].id === selected.id) still = out[m]; selected = still }
            })
        })
    }
    Timer { interval: 10000; running: true; repeat: true; onTriggered: root.refresh() }
    Component.onCompleted: Qt.callLater(refresh)

    // Comments are Scala `ext` items (ns "scala", kind "comment"). Your own app's data would use
    // your own namespace, e.g. { ns: "com.example.myapp", kind: "note", ... }.
    function commentsOf(ev) {
        var xs = (ev && Array.isArray(ev.ext)) ? ev.ext : [], out = []
        for (var i = 0; i < xs.length; i++)
            if (xs[i] && xs[i].ns === "scala" && xs[i].kind === "comment" && xs[i].data && typeof xs[i].data.text === "string") out.push(xs[i])
        return out
    }
    property bool posting: false
    function postComment(text) {
        text = String(text || "").trim()
        if (!text || !selected || posting) return
        posting = true
        var item = { ns: "scala", kind: "comment", target: selected.id, data: { text: text } }
        call("postExt", [selected.calendarId, JSON.stringify(item)], function (r) {
            posting = false
            var res = j(r, {})
            if (res && res.ok) { input.text = ""; refresh() }
            else status = "Couldn't post the comment" + (res && res.error ? ": " + res.error : ".")
        })
    }

    // ── UI (colours from the Logos design system, so it matches Basecamp) ──
    Rectangle { anchors.fill: parent; color: Theme.palette.background }

    ColumnLayout {
        anchors.fill: parent; anchors.margins: 16; spacing: 10

        LogosText { text: "Next 7 days"; font.pixelSize: 20 }
        LogosText { visible: root.status !== ""; text: root.status; textFormat: Text.PlainText; wrapMode: Text.Wrap; Layout.fillWidth: true }

        ListView {
            Layout.fillWidth: true; Layout.fillHeight: true; clip: true; spacing: 4
            model: root.upcoming
            delegate: Rectangle {
                required property var modelData
                width: ListView.view.width; height: 48; radius: 6
                color: root.selected && root.selected.id === modelData.id ? Theme.palette.backgroundSecondary : "transparent"
                Column {
                    anchors.verticalCenter: parent.verticalCenter; x: 10; width: parent.width - 20
                    LogosText { text: parent.parent.modelData.title || "(untitled)"; textFormat: Text.PlainText; elide: Text.ElideRight; width: parent.width }
                    LogosText {
                        textFormat: Text.PlainText; font.pixelSize: 12; opacity: 0.7
                        text: Qt.formatDateTime(new Date(parent.parent.modelData.startTime), "ddd d MMM hh:mm") + "  ·  " + (root.calendars[parent.parent.modelData.calendarId] || "")
                    }
                }
                MouseArea { anchors.fill: parent; onClicked: root.selected = parent.modelData }
            }
        }

        ColumnLayout {
            visible: root.selected !== null; Layout.fillWidth: true; spacing: 6
            LogosText { text: root.selected ? "Comments on “" + (root.selected.title || "(untitled)") + "”" : ""; textFormat: Text.PlainText }
            Repeater {
                model: root.commentsOf(root.selected)
                delegate: LogosText { required property var modelData; text: "• " + modelData.data.text; textFormat: Text.PlainText; wrapMode: Text.Wrap; Layout.fillWidth: true }
            }
            RowLayout {
                Layout.fillWidth: true
                TextField { id: input; Layout.fillWidth: true; placeholderText: "Add a comment…"; onAccepted: root.postComment(text) }
                Button { text: root.posting ? "Posting…" : "Post"; enabled: !root.posting && input.text.trim() !== ""; onClicked: root.postComment(input.text) }
            }
        }
    }
}
