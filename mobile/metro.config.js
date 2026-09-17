const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = path.resolve(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  projectRoot,
  watchFolders: [projectRoot],
  resolver: {
    blockList: [
      /.*\.log$/,
      /.*\.txt$/
    ]
  }
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
