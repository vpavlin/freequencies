// Offscreen render harness for FrequenciesView.qml: a mock `logos` bridge (callModuleAsync) that
// plays the Scala core with a few club nights, then screenshots the board, a selected night, the
// status columns and the new-night dialog.   usage: harness <FrequenciesView.qml> <outDir>
#include <QGuiApplication>
#include <QQuickView>
#include <QQmlContext>
#include <QQmlEngine>
#include <QQmlExpression>
#include <QQuickItem>
#include <QTimer>
#include <QImage>
#include <QDateTime>
#include <QJSValue>
#include <QJsonArray>
#include <QJsonObject>
#include <QJsonDocument>

static QString CALS, EVENTS;

class MockLogos : public QObject {
    Q_OBJECT
public:
    explicit MockLogos(QObject *p = nullptr) : QObject(p) {}
    Q_INVOKABLE QString callModule(const QString &mod, const QString &method, const QVariant &args);
    Q_INVOKABLE void callModuleAsync(const QString &mod, const QString &method, const QVariant &args, const QJSValue &cb, int timeoutMs);
};
QString MockLogos::callModule(const QString &mod, const QString &method, const QVariant &args) {
    if (mod == "whisperbox_core") {          // two forms: one mine with answers, one someone else's
        if (method != "snapshot") { QStringList parts; for (const auto &v : args.toList()) parts << v.toString(); fprintf(stderr, "[WB] %s(%s)\n", qPrintable(method), qPrintable(parts.join(" | "))); }
        if (method == "snapshot") return QString::fromUtf8(R"J({"v":1,"state":{"forms":{
          "form-a1":{"id":"form-a1","title":"Guest list: Bassline Fridays","status":"open","creator":"0xme","mine":true,"newResponses":1,
            "questions":[{"id":"q1","type":"text","text":"Name at the door"},{"id":"q2","type":"number","text":"Plus-ones"},{"id":"q3","type":"email","text":"Email (optional)"}]},
          "form-b2":{"id":"form-b2","title":"Crew for Bassline Fridays","status":"closed","creator":"0xpromoter111111","mine":false}}},
          "creatorView":{"responses":{"form-a1":[{},{},{}]}}})J");
        if (method == "formSummary") {
            const QString fid = args.toList().value(0).toString();
            if (fid == "form-a1") return R"J({"ok":true,"formId":"form-a1","title":"Guest list: Bassline Fridays","status":"open","mine":true,"coOwner":false,"canRead":true,"receipts":2,"responses":3,"newResponses":1,"lastResponseAt":1791620000000})J";
            if (fid == "form-b2") return R"J({"ok":true,"formId":"form-b2","title":"Crew for Bassline Fridays","status":"closed","mine":false,"coOwner":false,"canRead":false,"receipts":0})J";
            return R"({"ok":false,"error":"unknown form"})";
        }
        if (method == "createForm") return R"({"ok":true,"formId":"form-new1"})";
        if (method == "shareUri") return R"({"ok":true,"uri":"whisperbox://form?id=form-new1&by=0xme"})";
        if (method == "getDecryptedResponses") return QString::fromUtf8(R"({"ok":true,"responses":[
          {"submittedAt":1791600000000,"answers":[{"questionId":"q1","value":"Jana Nováková"},{"questionId":"q2","value":2},{"questionId":"q3","value":""}]},
          {"submittedAt":1791610000000,"answers":[{"questionId":"q1","value":"Petr K."},{"questionId":"q2","value":0}]},
          {"submittedAt":1791620000000,"answers":[{"questionId":"q1","value":"Mira"},{"questionId":"q2","value":1},{"questionId":"q3","value":"mira@example.org"}]}]})");
        return "";
    }
    if (mod == "kith") {                      // the kith core: one artist book
        if (method == "listBooks") return R"([{"id":"b1","name":"Artists","contactCount":3}])";
        if (method == "listContacts") return R"([{"id":"k1","name":{"display":"DJ Nikola"}},{"id":"k2","name":{"display":"Mira Vex"}},{"id":"k3","name":"broken"},{"id":"k4","name":{"display":"Oskar B2B Lena"}},{"id":"k5","name":{"display":"Jana Dvořáková"}}])";
        return "";
    }
    if (method != "listCalendars" && method != "listAllEvents" && method != "coreVersion") {
        QStringList parts; for (const auto &v : args.toList()) parts << v.toString();
        fprintf(stderr, "[CALL] %s(%s)\n", qPrintable(method), qPrintable(parts.join(" | ")));
    }
    if (method == "listCalendars") return CALS;
    if (method == "listAllEvents") return EVENTS;
    if (method == "coreVersion") return "\"0.12.0\"";
    if (method == "updateEvent") {           // echo the id, like the core
        QJsonObject o = QJsonDocument::fromJson(args.toList().value(0).toString().toUtf8()).object();
        return "\"" + o.value("id").toString() + "\"";
    }
    if (method == "getEvent") {               // the freshest copy, as the core returns it
        const QString id = args.toList().value(0).toString();
        for (const auto &v : QJsonDocument::fromJson(EVENTS.toUtf8()).array())
            if (v.toObject().value("id").toString() == id) return QString::fromUtf8(QJsonDocument(v.toObject()).toJson(QJsonDocument::Compact));
        return "{}";
    }
    if (method == "createEvent") return "\"new-1\"";
    if (method == "updateCalendarMeta") return "true";
    if (method == "postExt") return R"({"ok":true,"id":"x-new"})";
    return "";
}
void MockLogos::callModuleAsync(const QString &mod, const QString &method, const QVariant &args, const QJSValue &cb, int) {
    const QString r = callModule(mod, method, args);
    QJSValue f = cb;
    QTimer::singleShot(0, this, [f, r]() mutable { if (f.isCallable()) f.call(QJSValueList{ QJSValue(r) }); });
}

static QJsonObject night(const QString &id, const QString &cal, qint64 start, int hours, const QString &title,
                         const QString &status, const QString &venue, const QJsonArray &ext = {}) {
    QJsonObject f{{"status", status}, {"venue", venue}, {"type", "Club night"}};
    QJsonObject o{{"id", id}, {"calendarId", cal}, {"title", title}, {"startTime", start}, {"endTime", start + hours * 3600000LL},
                  {"fields", f}, {"creatorId", "0xme"}};
    if (!ext.isEmpty()) o["ext"] = ext;
    return o;
}
static void grab(QQuickView *v, const QString &path) {
    QImage img = v->grabWindow();
    if (!img.isNull()) { img.save(path); fprintf(stderr, "[shot] %s\n", qPrintable(path)); }
}
static void runJs(QQuickView *v, const QString &js) {
    QQmlExpression e(QQmlEngine::contextForObject(v->rootObject()), v->rootObject(), js);
    e.evaluate();
    if (e.hasError()) fprintf(stderr, "[js-err] %s :: %s\n", qPrintable(js), qPrintable(e.error().toString()));
}

int main(int argc, char **argv) {
    qInstallMessageHandler([](QtMsgType t, const QMessageLogContext &, const QString &m) { fprintf(stderr, "[qml:%d] %s\n", t, qPrintable(m)); });
    QGuiApplication app(argc, argv);
    if (argc < 3) return 2;
    const QString qml = argv[1], out = argv[2];
    QDateTime d0 = QDateTime(QDate::currentDate(), QTime(22, 0));
    auto at = [&](int day, int h = 22) { return QDateTime(QDate::currentDate().addDays(day), QTime(h, 0)).toMSecsSinceEpoch(); };
    Q_UNUSED(d0);
    QJsonArray schema{QJsonObject{{"key","status"},{"label","Status"},{"type","enum"},{"options",QJsonArray{"Hold","Confirmed","Cancelled"}}},
                      QJsonObject{{"key","venue"},{"label","Venue"},{"type","text"}},
                      QJsonObject{{"key","type"},{"label","Type"},{"type","enum"},{"options",QJsonArray{"Club night","Concert","Residency","Other"}}}};
    QJsonArray cals{
        QJsonObject{{"id","c1"},{"name","Basement Collective"},{"schema",schema},{"owner","0xme"},{"authorAddr","0xme"},{"roles",QJsonObject{}},{"open",true}},
        QJsonObject{{"id","c2"},{"name","Family"},{"schema",QJsonArray{}},{"owner","0xme"},{"authorAddr","0xme"},{"roles",QJsonObject{}},{"open",true}},
        QJsonObject{{"id","c3"},{"name","Venue Partners"},{"schema",QJsonArray{}},{"owner","0xother"},{"authorAddr","0xme"},{"roles",QJsonObject{}},{"open",true}},
        QJsonObject{{"id","c4"},{"name","Studio projects"},{"schema",QJsonArray{QJsonObject{{"key","status"},{"label","Status"},{"type","text"}}}},{"owner","0xme"},{"authorAddr","0xme"},{"roles",QJsonObject{}},{"open",true}}};
    QJsonArray comment{QJsonObject{{"ns","scala"},{"kind","comment"},{"target","n1"},{"id","x-1"},{"author","0xpromoter111111"},
                                   {"hlc",QJsonObject{{"wall",double(at(-1,14))},{"ctr",0},{"dev","0xpromoter"}}},{"data",QJsonObject{{"text","Rider confirmed, two CDJs + mixer"}}}}};
    auto artist = [&](const QString &id, const QString &target, const QString &author, const QJsonObject &data) {
        return QJsonObject{{"ns","xyz.frequencies"},{"kind","artist"},{"target",target},{"id",id},{"author",author},
                           {"hlc",QJsonObject{{"wall",double(at(-1,12))},{"ctr",0},{"dev","d"}}},{"data",data}};
    };
    QJsonArray n1ext = comment;
    n1ext.append(artist("a1","n1","0xme",QJsonObject{{"name","DJ Nikola"},{"contact","k1"},{"book","b1"},{"fee",250},{"currency","EUR"},{"set","23:00–01:00"},{"status","confirmed"}}));
    n1ext.append(artist("a2","n1","0xpromoter111111",QJsonObject{{"name","Local Warmup"},{"fee",80},{"currency","EUR"},{"set","22:00–23:00"},{"status","asked"}}));
    n1ext.append(artist("a3","n1","0xme",QJsonObject{{"name","Nobody"},{"status","cancelled"}}));
    n1ext.append(artist("a4","n1","0xme",QJsonValue("garbage").toObject()));
    auto form = [&](const QString &fid, const QString &author, const QString &purpose, const QString &title) {
        return QJsonObject{{"ns","xyz.frequencies"},{"kind","form"},{"target","n1"},{"id",fid},{"author",author},
                           {"hlc",QJsonObject{{"wall",double(at(-1,13))},{"ctr",0},{"dev","d"}}},
                           {"data",QJsonObject{{"formId",fid},{"uri","whisperbox://form?id="+fid+"&by="+author},{"purpose",purpose},{"title",title}}}};
    };
    n1ext.append(form("form-a1","0xme","guestlist","Guest list: Bassline Fridays"));
    n1ext.append(form("form-b2","0xpromoter111111","crew","Crew for Bassline Fridays"));
    n1ext.append(QJsonObject{{"ns","xyz.frequencies"},{"kind","form"},{"target","n1"},{"id","bad"},{"data",42}});
    auto crewItem = [&](const QString &id, const QString &target, const QString &author, const QJsonObject &data) {
        return QJsonObject{{"ns","xyz.frequencies"},{"kind","crew"},{"target",target},{"id",id},{"author",author},
                           {"hlc",QJsonObject{{"wall",double(at(-1,12))},{"ctr",0},{"dev","d"}}},{"data",data}};
    };
    auto checkin = [&](const QString &slot, const QString &author, double when) {
        return QJsonObject{{"ns","xyz.frequencies"},{"kind","checkin"},{"target","n1"},{"id","checkin:"+slot},{"author",author},
                           {"hlc",QJsonObject{{"wall",when},{"ctr",0},{"dev","d"}}},{"data",QJsonObject{{"crew",slot},{"at",when}}}};
    };
    n1ext.append(crewItem("cr1","n1","0xme",QJsonObject{{"name","Jana Door"},{"contact","k5"},{"book","b2"},{"role","Door"},{"call","21:30"},{"status","confirmed"}}));
    n1ext.append(crewItem("cr2","n1","0xme",QJsonObject{{"name","Petr"},{"role","Bar"},{"call","21:00"},{"status","asked"}}));
    n1ext.append(crewItem("cr3","n1","0xpromoter111111",QJsonObject{{"name",""},{"role","Bar"},{"call","22:00"}}));
    n1ext.append(crewItem("cr4","n1","0xpromoter111111",QJsonObject{{"name","Ota"},{"role","Sound"},{"call","20:00"},{"status","confirmed"}}));
    n1ext.append(crewItem("cr5","n1","0xme",QJsonValue(7).toObject()));
    n1ext.append(checkin("cr4","0xpromoter111111",double(at(0,20))));
    n1ext.append(checkin("cr3","0xme",double(at(0,20))));   // open slot: ignored
    QJsonArray n2ext{artist("b1","n2","0xme",QJsonObject{{"name","DJ Nikola (renamed)"},{"contact","k1"},{"set","02:00–04:00"},{"status","asked"}}),
                     crewItem("cr9","n2","0xme",QJsonObject{{"name","Jana D."},{"contact","k5"},{"role","Bar"},{"status","asked"}})};
    QJsonArray evs{
        night("n1","c1",at(0),6,"Bassline Fridays","Confirmed","Cross Club",n1ext),
        night("n2","c1",at(0,23),5,"Techno Lab","Hold","Ankali",n2ext),
        night("n3","c1",at(1),6,"Dub Session","Confirmed","Cross Club"),
        night("n4","c1",at(3),5,"Afterhours","Cancelled","Fuchs2"),
        night("n5","c1",at(7),6,"Bassline Fridays #2","Hold","Cross Club"),
        night("n6","c1",at(8),4,"Live: Modular","Confirmed",""),
        QJsonObject{{"id","f1"},{"calendarId","c2"},{"title","Grandma's birthday"},{"startTime",double(at(2,15))},{"endTime",double(at(2,18))}}};
    CALS = QString::fromUtf8(QJsonDocument(cals).toJson(QJsonDocument::Compact));
    EVENTS = QString::fromUtf8(QJsonDocument(evs).toJson(QJsonDocument::Compact));

    MockLogos *logos = new MockLogos(&app);
    QQuickView view;
    view.rootContext()->setContextProperty("logos", logos);
    view.setResizeMode(QQuickView::SizeRootObjectToView);
    view.resize(1280, 760);
    view.setSource(QUrl::fromLocalFile(qml));
    if (view.status() == QQuickView::Error) { for (const auto &e : view.errors()) fprintf(stderr, "[load-err] %s\n", qPrintable(e.toString())); return 3; }
    view.show();
    QTimer::singleShot(800,  [&] { grab(&view, out + "/01-board-venue.png"); runJs(&view, "selected = grid.days[0].cells[0][0]"); });
    QTimer::singleShot(1200, [&] { grab(&view, out + "/02-night-panel.png"); runJs(&view, "setField('status', 'Hold')"); });
    QTimer::singleShot(1500, [&] { runJs(&view, "selected = null; laneBy = 'status'"); });
    QTimer::singleShot(1800, [&] { grab(&view, out + "/03-board-status.png"); runJs(&view, "openNew()"); });
    QTimer::singleShot(2200, [&] { grab(&view, out + "/04-new-night.png"); runJs(&view, "nTitle.text = 'Test night'; nVenue.text = 'Cross Club'; createNight()"); });
    QTimer::singleShot(2600, [&] { runJs(&view, "adoptCalendar(calById('c2')); adoptCalendar(calById('c4'))"); });
    QTimer::singleShot(2800, [&] { grab(&view, out + "/05-adopt-refused.png"); });
    QTimer::singleShot(3000, [&] { runJs(&view, "laneBy = 'venue'; selected = grid.days[0].cells[0][0]"); });
    QTimer::singleShot(3300, [&] { grab(&view, out + "/06-lineup.png"); runJs(&view, "openArtist(null)"); });
    QTimer::singleShot(3700, [&] { runJs(&view, "aSearch.text = 'mi'"); });
    QTimer::singleShot(3900, [&] { grab(&view, out + "/07-add-artist.png"); runJs(&view, "root.aContact = 'k2'; root.aBook = 'b1'; aName.text = 'Mira Vex'; aFee.text = '300'; aSet.text = '01:00–03:00'; saveArtist()"); });
    QTimer::singleShot(4400, [&] { runJs(&view, "openArtist(lineupOf(selMaster)[0])"); });
    QTimer::singleShot(4800, [&] { grab(&view, out + "/08-others-booking.png"); runJs(&view, "artistPopup.close()"); });
    QTimer::singleShot(5000, [&] { runJs(&view, "openArtist(null); kithState = 'missing'"); });
    QTimer::singleShot(5300, [&] { grab(&view, out + "/09-no-kith.png"); });
    QTimer::singleShot(5500, [&] { runJs(&view, "artistPopup.close(); selected = null"); });
    QTimer::singleShot(5600, [&] { runJs(&view, "selected = grid.days[0].cells[0][0]"); });
    QTimer::singleShot(6000, [&] { runJs(&view, "panelFlick.contentY = 380"); });
    QTimer::singleShot(6200, [&] { grab(&view, out + "/10-forms.png"); runJs(&view, "formPopup.open()"); });
    QTimer::singleShot(6500, [&] { grab(&view, out + "/11-add-form.png"); runJs(&view, "addForm('booking')"); });
    QTimer::singleShot(6900, [&] { runJs(&view, "openResponses(formsOf(selMaster)[0])"); });
    QTimer::singleShot(7300, [&] { grab(&view, out + "/12-answers.png"); });
    QTimer::singleShot(7500, [&] { runJs(&view, "respPopup.close(); panelFlick.contentY = 300"); });
    QTimer::singleShot(7800, [&] { grab(&view, out + "/13-crew.png"); runJs(&view, "openCrew(null)"); });
    QTimer::singleShot(8200, [&] { runJs(&view, "cRole.text = 'Bar'; cSearch.text = 'ja'"); });
    QTimer::singleShot(8500, [&] { grab(&view, out + "/14-add-crew.png"); runJs(&view, "crewPopup.close()"); });
    QTimer::singleShot(8800, [&] { app.quit(); });
    return app.exec();
}
#include "harness.moc"
