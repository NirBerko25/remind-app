const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-maps has no web implementation — stub it out so the web
// bundle doesn't pull in native-only code that breaks Metro.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'sourceFile', filePath: require.resolve('./src/stubs/maps.web.js') };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
