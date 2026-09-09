const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const iconDir = path.join(__dirname, '..', 'apps', 'desktop', 'assets', 'icons');
  const names = fs.readdirSync(iconDir).filter(name => name.endsWith('.svg'));
  for (const filename of names) {
    const source = path.join(iconDir, filename);
    const target = path.join(iconDir, path.basename(filename, '.svg') + '.png');
    const svg = fs.readFileSync(source);
    const win = new BrowserWindow({
      show: false, width: 256, height: 256, frame: false,
      webPreferences: { offscreen: true }
    });
    await win.loadURL('data:image/svg+xml;base64,' + svg.toString('base64'));
    const image = await win.capturePage({ x: 0, y: 0, width: 256, height: 256 });
    if (image.isEmpty()) throw new Error('Chromium could not render ' + filename);
    fs.writeFileSync(target, image.toPNG());
    win.destroy();
    console.log('rendered ' + path.basename(target));
  }
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
