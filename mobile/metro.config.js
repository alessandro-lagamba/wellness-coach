const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix module resolution for workspace setup
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../');

// ✅ CRITICAL: Force all React/React Native resolution to mobile/node_modules
config.resolver.extraNodeModules = {
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  '@react-native': path.resolve(projectRoot, 'node_modules/@react-native'),
  '@react-native-community': path.resolve(projectRoot, 'node_modules/@react-native-community'),
  'expo-linear-gradient': path.resolve(projectRoot, 'node_modules/expo-linear-gradient'),
};

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
      'backend/node_modules/.*', // ✅ CRITICAL: Block backend node_modules
    ].join('|')
  ),
};

// Fix watchman configuration for workspace
config.watchFolders = [
  // Mantieni la root del monorepo per risoluzioni, ma evita node_modules non rilevanti con blockList
  workspaceRoot,
];

module.exports = config;
