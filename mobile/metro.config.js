const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix module resolution for workspace setup
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];

// Ensure proper platform resolution
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Fix watchman configuration for workspace
config.watchFolders = [
  path.resolve(__dirname, '../'),
];

module.exports = config;
