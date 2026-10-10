// Both SDKs must sit on the same loam-transport commit, or the Metro redirect (metro.config.js)
// would hand kith-sdk a different version of the transport than the one it was written against.
const { execSync } = require("child_process");
const head = (dir) => execSync("git rev-parse HEAD", { cwd: __dirname + "/../" + dir }).toString().trim();
const a = head("src/lib/loam-transport-pkg"), b = head("src/kith/loam-transport-pkg");
if (a !== b) { console.error(`loam-transport differs: scala-sdk ${a.slice(0, 7)} vs kith-sdk ${b.slice(0, 7)}`); process.exit(1); }
console.log("ONE TRANSPORT OK (" + a.slice(0, 7) + ")");
