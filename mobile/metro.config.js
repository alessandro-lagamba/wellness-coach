const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Project root is the mobile folder
const projectRoot = __dirname;

// For pnpm monorepos, we need to ensure Metro resolves from mobile/node_modules
// and doesn't get confused by the symlink structure in .pnpm

// 1. DO NOT watch the workspace root - this causes pnpm resolution issues
// config.watchFolders = []; // Remove this line, let Metro use defaults

// 2. Force resolution of key packages to mobile/node_modules
config.resolver.extraNodeModules = new Proxy(
  {
    'react': path.resolve(projectRoot, 'node_modules/react'),
    'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
    'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  },
  {
    get: (target, name) => {
      // If we have an explicit mapping, use it
      if (target[name]) {
        return target[name];
      }
      // Otherwise, try to resolve from mobile/node_modules first
      const localPath = path.resolve(projectRoot, 'node_modules', name);
      try {
        require.resolve(localPath);
        return localPath;
      } catch {
        // Fall back to default resolution
        return path.join(projectRoot, 'node_modules', name);
      }
    },
  }
);

// 3. Node modules paths - tell Metro where to look for node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  // Also include root node_modules for shared deps, but mobile takes priority
  path.resolve(projectRoot, '../node_modules'),
];

// 4. Block non-mobile folders to prevent Metro from crawling them
// Use absolute paths to be precise and not accidentally block mobile subfolders
const workspaceRoot = path.resolve(projectRoot, '..');
config.resolver.blockList = [
  new RegExp(`${workspaceRoot}/backend/.*`),
  new RegExp(`${workspaceRoot}/web-advanced/.*`),
  new RegExp(`${workspaceRoot}/web/.*`),
  new RegExp(`${workspaceRoot}/LiveKit implementation/.*`),
  new RegExp(`${workspaceRoot}/audio-orb/.*`),
  new RegExp(`${workspaceRoot}/docs/.*`),
  new RegExp(`${workspaceRoot}/shared/.*`),  // Only block root-level shared, not mobile/components/shared
];

// 5. Ensure proper platform resolution
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// 6. Disable unstable features that cause issues
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
