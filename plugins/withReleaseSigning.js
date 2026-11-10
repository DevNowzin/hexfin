// Assina o APK de release com a chave que fica FORA do projeto (nunca no Git).
// Lê `~/.hexfin/signing.properties` (ou o caminho em HEXFIN_SIGNING) com:
//   storeFile=C:/caminho/para/hexfin.jks
//   storePassword=...
//   keyAlias=...
//   keyPassword=...
const { withAppBuildGradle } = require('expo/config-plugins');

const LOAD = `
// HexFin: chave de assinatura fora do projeto (plugins/withReleaseSigning.js).
def hexfinSigning = new Properties()
def hexfinSigningFile = new File(System.getenv('HEXFIN_SIGNING') ?: "\${System.getProperty('user.home')}/.hexfin/signing.properties")
if (hexfinSigningFile.exists()) {
    hexfinSigningFile.withInputStream { hexfinSigning.load(it) }
}
`;

const RELEASE_CONFIG = `
        release {
            if (hexfinSigning['storeFile']) {
                storeFile file(hexfinSigning['storeFile'])
                storePassword hexfinSigning['storePassword']
                keyAlias hexfinSigning['keyAlias']
                keyPassword hexfinSigning['keyPassword']
            }
        }`;

function patch(contents) {
  if (contents.includes('hexfinSigning')) return contents;
  const signingStart = contents.indexOf('signingConfigs {');
  if (signingStart < 0) throw new Error('withReleaseSigning: bloco signingConfigs não encontrado no build.gradle');
  const debugStart = contents.indexOf('debug {', signingStart);
  const debugEnd = contents.indexOf('}', debugStart);
  if (debugStart < 0 || debugEnd < 0) throw new Error('withReleaseSigning: signingConfigs.debug não encontrado');
  let next = contents.slice(0, debugEnd + 1) + RELEASE_CONFIG + contents.slice(debugEnd + 1);
  const releaseType = next.indexOf('release {', next.indexOf('buildTypes {'));
  const debugSigning = next.indexOf('signingConfig signingConfigs.debug', releaseType);
  if (releaseType < 0 || debugSigning < 0) throw new Error('withReleaseSigning: buildTypes.release não encontrado');
  next = next.slice(0, debugSigning) + 'signingConfig signingConfigs.release' + next.slice(debugSigning + 'signingConfig signingConfigs.debug'.length);
  const androidBlock = next.indexOf('\nandroid {');
  if (androidBlock < 0) throw new Error('withReleaseSigning: bloco android não encontrado');
  return next.slice(0, androidBlock) + LOAD + next.slice(androidBlock);
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = patch(modConfig.modResults.contents);
    return modConfig;
  });
};
module.exports.patch = patch;
