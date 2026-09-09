import fs from 'node:fs/promises';
import path from 'node:path';
import pngToIco from 'png-to-ico';

const root = path.resolve(import.meta.dirname, '..');
const iconDir = path.join(root, 'apps', 'desktop', 'assets', 'icons');
const names = (await fs.readdir(iconDir))
  .filter(name => name.endsWith('.png'))
  .map(name => path.basename(name, '.png'));

for (const name of names) {
  const png = path.join(iconDir, name + '.png');
  const ico = path.join(iconDir, name + '.ico');
  await fs.writeFile(ico, await pngToIco(png));
  console.log(`built ${name}.ico`);
}
