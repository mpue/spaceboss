// Linux-Pakete der Desktop-App bauen:  npm run dist:linux  -> dist/Spaceboss-<version>.AppImage und -linux.tar.gz
//
// Unter Linux läuft electron-builder direkt. Unter Windows und macOS fehlen ihm die Linux-Werkzeuge (mksquashfs
// fürs AppImage, Ausführrechte im tar.gz), dort baut es im Docker-Container electronuserland/builder – dafür muss
// Docker Desktop laufen. Dessen node_modules und die Electron-Downloads liegen in eigenen Docker-Volumes, das
// node_modules des Projekts bleibt unangetastet. Weitere Argumente gehen an electron-builder:
//   npm run dist:linux -- --arm64
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMAGE = 'electronuserland/builder:22';
const args = ['--linux', ...process.argv.slice(2)];

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: 'inherit' });
  if (r.error) {
    console.error(r.error.code === 'ENOENT' ? `${cmd} nicht gefunden – unter Windows Docker Desktop installieren und starten` : r.error.message);
    process.exit(1);
  }
  process.exit(r.status ?? 1);
}

if (process.platform === 'linux') run(process.execPath, [require.resolve('electron-builder/cli.js'), ...args]);

console.log(`Linux-Build im Docker-Container (${IMAGE}) ...`);
run('docker', [
  'run', '--rm',
  '-v', `${ROOT}:/project`,
  '-v', 'spaceboss-node-modules:/project/node_modules',
  '-v', 'spaceboss-electron-cache:/root/.cache/electron',
  '-v', 'spaceboss-builder-cache:/root/.cache/electron-builder',
  '-e', 'ELECTRON_SKIP_BINARY_DOWNLOAD=1',
  '-w', '/project',
  IMAGE,
  'bash', '-c', 'npm ci --no-audit --no-fund && exec npx electron-builder "$@"', '--', ...args,
]);
