// Configuração do Metro (bundler do Expo).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// O build ESM (.mjs) do @anthropic-ai/sdk tem imports circulares que quebram no
// Android/iOS ("Cannot read property 'BetaToolRunner' of undefined"). O build
// CommonJS do mesmo pacote resolve os ciclos na hora do uso, então forçamos ele.
const SDK = '@anthropic-ai/sdk';
const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve ?? context.resolveRequest;
  if (moduleName === SDK || moduleName.startsWith(`${SDK}/`)) {
    return resolve({ ...context, unstable_conditionNames: ['require', 'react-native'] }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
