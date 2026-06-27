const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/** @type {import('@react-native/metro-config').MetroConfig} */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // Bundle .tflite model files as assets so they can be loaded with require().
    assetExts: [...defaultConfig.resolver.assetExts, 'tflite'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
