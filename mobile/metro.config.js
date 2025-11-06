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

// ✅ Abilita il supporto per "conditional exports"
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  // Ignora workspace esterni che non fanno parte dell'app mobile
  blockList: new RegExp(
    [
      'web-advanced/node_modules/.*',
      'web/node_modules/.*',
    ].join('|')
  ),
};

// Fix watchman configuration for workspace
config.watchFolders = [
  // Mantieni la root del monorepo per risoluzioni, ma evita node_modules non rilevanti con blockList
  path.resolve(__dirname, '../'),
];

module.exports = config;
