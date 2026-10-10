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
    if (mod == "kith") {                      // the kith core: one artist book
        if (method == "listBooks") return R"([{"id":"b1","name":"Artists","contactCount":3}])";
        if (method == "listContacts") return R"([{"id":"k1","name":{"display":"DJ Nikola"}},{"id":"k2","name":{"display":"Mira Vex"}},{"id":"k3","name":"broken"},{"id":"k4","name":{"display":"Oskar B2B Lena"}}])";
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
    QJsonArray n2ext{artist("b1","n2","0xme",QJsonObject{{"name","DJ Nikola (renamed)"},{"contact","k1"},{"set","02:00–04:00"},{"status","asked"}})};
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
    QTimer::singleShot(5500, [&] { app.quit(); });
    return app.exec();
}
#include "harness.moc"
