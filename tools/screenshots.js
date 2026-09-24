// Echte Spielszenen für die Webseite: lässt den Autopiloten an festen Stellen spielen und fotografiert
// das Bild unsichtbar in 1920×1080.
//
//   npx electron tools/screenshots.js            -> site/shots/*.jpg
//
// Jede Szene: Level, Startspalte und die Sekunden, nach denen ein Bild gemacht wird.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { start } = require('../server.js');

const OUT = path.join(__dirname, '..', 'site', 'shots');
const SCENES = [
  { name: 'crash-site', level: 1, at: 40, shots: [6, 10, 14] },
  { name: 'spaceboss', level: 1, at: 346, shots: [9, 13, 17] },
  { name: 'hive', level: 2, at: 100, shots: [6, 10, 14] },
  { name: 'queen', level: 2, at: 223, shots: [10, 14, 18] },
  { name: 'mothership', level: 3, at: 170, shots: [6, 10, 14] },
  { name: 'outbacks', level: 4, at: 120, shots: [6, 10, 14] },
  { name: 'devourer', level: 4, at: 278, shots: [10, 13, 16, 19] },
  { name: 'swamp', level: 5, at: 150, shots: [6, 10, 14] },
  { name: 'rotmother', level: 5, at: 278, shots: [10, 14, 18] },
  { name: 'alien-base', level: 6, at: 90, shots: [6, 10, 14] },
  { name: 'warlord', level: 6, at: 266, shots: [10, 14, 18, 22] },
];

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await start({ port: 0, host: '127.0.0.1' });
  const win = new BrowserWindow({
    width: 1920, height: 1080, useContentSize: true, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  win.webContents.setAudioMuted(true);
  win.webContents.setFrameRate(60);
  for (const s of SCENES) {
    await win.loadURL(`http://127.0.0.1:${srv.port}/?demo=1&level=${s.level}&at=${s.at}&idle=9999`);
    const t0 = Date.now();
    for (const [i, sec] of s.shots.entries()) {
      await new Promise(r => setTimeout(r, Math.max(0, sec * 1000 - (Date.now() - t0))));
      const img = await win.webContents.capturePage();
      const file = path.join(OUT, `${s.name}-${i + 1}.jpg`);
      fs.writeFileSync(file, img.toJPEG(90));
      console.log('bild', path.basename(file), img.getSize().width + 'x' + img.getSize().height);
    }
  }
  srv.server.close();
  app.exit(0);
});
