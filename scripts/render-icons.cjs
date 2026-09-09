const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

app.setPath('userData', path.join(os.tmpdir(), 'dt-icon-renderer'));

app.whenReady().then(async () => {
  const iconDir = path.join(__dirname, '..', 'apps', 'desktop', 'assets', 'icons');
  const names = fs.readdirSync(iconDir).filter(name => name.endsWith('.svg'));
  const win = new BrowserWindow({
    show: false, width: 256, height: 256, frame: false,
    webPreferences: { offscreen: true, partition: 'dt-icons' }
  });
  for (const filename of names) {
    const source = path.join(iconDir, filename);
    const target = path.join(iconDir, path.basename(filename, '.svg') + '.png');
    const svg = fs.readFileSync(source, 'utf8');
    const html = '<style>*{margin:0}body{width:256px;height:256px;overflow:hidden}</style>' + svg;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html) + '#' + filename);
    const image = await win.capturePage({ x: 0, y: 0, width: 256, height: 256 });
    if (image.isEmpty()) throw new Error('Chromium could not render ' + filename);
    fs.writeFileSync(target, image.toPNG());
    console.log('rendered ' + path.basename(target));
  }
  win.destroy();
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
