// Gera o APK assinado neste PC e, com --publish, publica como Release no GitHub.
//   npm run app:build                         → releases/HexFin-<versão>.apk
//   npm run app:release -- --notes "o que mudou" → gera e publica a versão no GitHub
// Precisa: Android SDK em C:\Android\Sdk (ou ANDROID_HOME, sem espaço no caminho), JDK em JAVA_HOME,
// chave em ~/.hexfin/signing.properties (fora do projeto) e, para publicar, `gh` com login.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const version = app.version;
const args = process.argv.slice(2);
const publish = args.includes('--publish');
const notesIndex = args.indexOf('--notes');
const notes = notesIndex >= 0 ? args[notesIndex + 1] : `HexFin ${version}`;
const repo = /UPDATE_REPO = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'src/features/update/release.ts'), 'utf8'))[1];
const isWindows = process.platform === 'win32';

function run(command, commandArgs, options = {}) {
  console.log(`\n> ${command} ${commandArgs.join(' ')}`);
  execFileSync(command, commandArgs, { stdio: 'inherit', cwd: root, shell: isWindows, ...options });
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const signing = process.env.HEXFIN_SIGNING || path.join(os.homedir(), '.hexfin', 'signing.properties');
if (!fs.existsSync(signing)) fail(`Chave não encontrada em ${signing}. Sem ela o APK não instala por cima.`);
// O NDK no Windows quebra com espaço no caminho do SDK (o clang++ vira nome curto e perde a libc++).
// Por isso o padrão é C:\Android\Sdk (pode ser um atalho de pasta para o SDK real).
const sdk = process.env.ANDROID_HOME || (isWindows ? 'C:\\Android\\Sdk' : path.join(os.homedir(), 'Android', 'Sdk'));
if (!fs.existsSync(sdk)) fail(`Android SDK não encontrado em ${sdk}.`);
if (sdk.includes(' ')) fail(`O caminho do Android SDK tem espaço (${sdk}). Crie um atalho sem espaço: mklink /J C:\\Android\\Sdk "<SDK>" e use ANDROID_HOME=C:\\Android\\Sdk.`);
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Versão inválida no app.json: ${version}`);

// No Windows o C++ do React Native passa do limite de 260 caracteres em caminhos longos.
// Então o build roda numa cópia espelhada em uma pasta curta e só o APK volta para o projeto.
const buildRoot = isWindows && root.length > 20 ? 'C:\\hexfin-build' : root;
if (buildRoot !== root) {
  console.log(`\n> espelhando o projeto em ${buildRoot}`);
  // Caminhos completos: um nome solto (ex.: "dist") excluiria também as pastas dos pacotes em node_modules.
  const excluded = ['.git', 'android', 'ios', 'dist', 'releases', 'reference', '.tools', '.expo', 'docs\\screenshots'].map((name) => path.join(root, name));
  const copy = spawnSync('robocopy', [root, buildRoot, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XD', ...excluded], { stdio: 'inherit' });
  if (copy.status === null || copy.status >= 8) fail('Não consegui copiar o projeto para a pasta de build.');
}

run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], { cwd: buildRoot });
const escapeProp = (value) => value.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
// CMake 3.31.6 do SDK: o ninja dele aceita caminhos longos (o da 3.22.1 trava em 260 caracteres).
const cmakeDir = path.join(sdk, 'cmake', '3.31.6');
if (!fs.existsSync(cmakeDir)) fail(`Falta o CMake 3.31.6 no SDK: sdkmanager "cmake;3.31.6".`);
fs.writeFileSync(path.join(buildRoot, 'android', 'local.properties'), `sdk.dir=${escapeProp(sdk)}\ncmake.dir=${escapeProp(cmakeDir)}\n`);
const androidDir = path.join(buildRoot, 'android');
const gradlew = path.join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew');
run(isWindows ? `"${gradlew}"` : gradlew, ['assembleRelease', '--no-daemon'], { cwd: androidDir });

const built = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(built)) fail('O Gradle terminou sem gerar o APK.');
fs.mkdirSync(path.join(root, 'releases'), { recursive: true });
const apk = path.join(root, 'releases', `HexFin-${version}.apk`);
fs.copyFileSync(built, apk);
console.log(`\n✓ APK: ${apk} (${Math.round(fs.statSync(apk).size / 1048576)} MB)`);

if (publish) {
  run('gh', ['release', 'create', `v${version}`, apk, '--repo', repo, '--title', `HexFin ${version}`, '--notes', notes]);
  console.log(`\n✓ Publicado: https://github.com/${repo}/releases/tag/v${version}`);
}
