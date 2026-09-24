// Spaceboss als Desktop-App: startet den eingebauten Server auf einem freien Port nur für diesen Rechner
// und zeigt das Spiel in einem eigenen Fenster.
//
//   npm run app            Entwicklung (Songs aus ./music)
//   npm run dist           Installer und portable .exe nach dist/
//   npm run dist:linux     AppImage und .tar.gz nach dist/ (unter Windows über Docker)
//
// F11 schaltet Vollbild um (im Menü geht auch F, im Spiel Doppelklick), --fullscreen startet im Vollbild.
// Eigene Songs: MUSIC_DIR setzen oder einen Ordner "music" neben die .exe bzw. das AppImage legen.
const { app, BrowserWindow, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { start } = require('../server.js');

// Musik und Sounds dürfen ohne vorherigen Klick starten (Titelmusik, Demo-Modus)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// nur ein Fenster: ein zweiter Start holt das laufende nach vorn
if (!app.requestSingleInstanceLock()) app.quit();

let win = null, srv = null;

// Ordner der gestarteten Datei: portable .exe und AppImage laufen entpackt bzw. eingehängt woanders,
// ihren echten Ort geben sie über Umgebungsvariablen mit
function exeDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (process.env.APPIMAGE) return path.dirname(process.env.APPIMAGE);
  return path.dirname(process.execPath);
}

function musicDir() {
  if (process.env.MUSIC_DIR) return process.env.MUSIC_DIR;
  const nextToExe = path.join(exeDir(), 'music');
  if (app.isPackaged && fs.existsSync(nextToExe)) return nextToExe;
  return app.isPackaged ? path.join(process.resourcesPath, 'music') : path.join(__dirname, '..', 'music');
}

async function createWindow() {
  srv = await start({ port: 0, host: '127.0.0.1', musicDir: musicDir() });
  const origin = `http://127.0.0.1:${srv.port}`;
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    useContentSize: true,
    backgroundColor: '#000000',
    title: 'Spaceboss',
    icon: path.join(__dirname, 'icon.png'),
    fullscreen: process.argv.includes('--fullscreen'),
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (!process.env.SPACEBOSS_SMOKE) win.once('ready-to-show', () => win.show());

  // Das Fenster bleibt beim Spiel: keine fremden Seiten, keine Popups
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(origin)) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // F11: Vollbild, F12: Entwicklerwerkzeuge (nur beim Entwickeln)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F12' && !app.isPackaged) { win.webContents.toggleDevTools(); e.preventDefault(); }
  });

  // Rauchtest für die Kommandozeile: lädt das Spiel, prüft es und beendet sich wieder
  if (process.env.SPACEBOSS_SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 4000));
      const info = await win.webContents.executeJavaScript(`(async () => ({
        levels: window.Level && Level.LEVELS.length,
        autopilot: typeof Autopilot === 'function',
        canvas: !!document.querySelector('canvas'),
        image: (await fetch('assets/war_torso.png')).status,
        songs: (await (await fetch('api/songs')).json()).map(s => s.name),
      }))()`);
      console.log('SMOKE ' + JSON.stringify(Object.assign({ origin, packaged: app.isPackaged, music: srv.musicDir }, info)));
      app.exit(0);
    });
  }
  win.on('closed', () => { win = null; });
  await win.loadURL(origin + '/');
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.whenReady().then(createWindow).catch(e => { console.error(e); app.exit(1); });
app.on('window-all-closed', () => {
  if (srv) srv.server.close();
  app.quit();
});
