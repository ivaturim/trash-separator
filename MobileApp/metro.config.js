// On web, swap native-only packages for simple stand-ins so the site loads.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const webStubs = {
  "react-native-maps": path.resolve(__dirname, "web-stubs/react-native-maps.js"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && webStubs[moduleName]) {
    return { type: "sourceFile", filePath: webStubs[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
