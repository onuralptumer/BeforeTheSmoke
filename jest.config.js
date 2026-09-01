module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // The native modules ship untranspiled ESM, so they must go through Babel
  // rather than being treated as pre-built CommonJS.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@shopify/react-native-skia|react-native-gesture-handler|react-native-safe-area-context|react-native-haptic-feedback|@react-native-async-storage)/)',
  ],
};
