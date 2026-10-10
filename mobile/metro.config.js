// Frequencies embeds two engines, scala-sdk (src/lib) and kith-sdk (src/kith), and each carries
// loam-transport as a submodule. The app must have ONE transport (one node connection, one set of
// receivers), so anything kith-sdk imports from its copy resolves to the scala-sdk copy instead.
// Keep both submodules on the same loam-transport commit.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
// whisperbox-sdk (src/whisperbox) ships its protocol as plain .mjs shared with its desktop core and tests.
if (!config.resolver.sourceExts.includes("mjs")) config.resolver.sourceExts.push("mjs");
const KITH_LT = path.join(__dirname, "src", "kith", "loam-transport-pkg") + path.sep;
const LIB_LT = path.join(__dirname, "src", "lib", "loam-transport-pkg") + path.sep;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const r = context.resolveRequest(context, moduleName, platform);
  if (r && r.type === "sourceFile" && r.filePath.startsWith(KITH_LT)) {
    return { ...r, filePath: LIB_LT + r.filePath.slice(KITH_LT.length) };
  }
  return r;
};

module.exports = config;
