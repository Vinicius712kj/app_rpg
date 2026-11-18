import { cpSync, lstatSync, mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = new URL('../../', import.meta.url);
const publico = new URL('../public/', import.meta.url);
const extensoes = new Set(['.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.json', '.woff2']);
const licencaIcones = fileURLToPath(new URL('assets/fonts/LICENSE-MaterialSymbols.txt', raiz));

mkdirSync(publico, { recursive: true });

for (const caminho of ['index.html', 'assets', 'core', 'features', 'sistemas']) {
  cpSync(fileURLToPath(new URL(caminho, raiz)), fileURLToPath(new URL(caminho, publico)), {
    recursive: true,
    filter(origem) {
      const tipo = lstatSync(origem);
      return tipo.isDirectory() || (tipo.isFile() && (extensoes.has(extname(origem).toLowerCase()) || origem === licencaIcones));
    }
  });
}
