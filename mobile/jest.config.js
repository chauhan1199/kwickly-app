module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|react-native-linear-gradient|react-native-svg|lucide-react-native|@react-native-async-storage/async-storage)/'
  ],
};
