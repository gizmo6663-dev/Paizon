// Kopierer nettappen til www/, som Capacitor pakker inn i Android-appen.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const OUT = 'www';
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of FILES) cpSync(f, `${OUT}/${f}`, { recursive: true });
console.log(`Kopierte ${FILES.length} filer/mapper til ${OUT}/`);
