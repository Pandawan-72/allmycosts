const { getDefaultConfig } = require("expo/metro-config");

// Keep Metro on Expo's supported defaults. The previous custom on-disk
// FileStore created a large .metro-cache inside the project archive.
module.exports = getDefaultConfig(__dirname);
