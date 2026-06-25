const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // Bundle .tflite model files as assets so they can be loaded with require().
    assetExts: [...defaultConfig.resolver.assetExts, 'tflite'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
