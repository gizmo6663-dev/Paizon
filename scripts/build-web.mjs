// Kopierer nettappen til www/, som Capacitor pakker inn i Android-appen.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const OUT = 'www';
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of FILES) cpSync(f, `${OUT}/${f}`, { recursive: true });

// Capacitor-runtime gir window.Capacitor.registerPlugin, som tilleggsmodulene
// (opplesning, tilbake-knapp) trenger i Android-appen. Androids egen bro har den ikke.
cpSync('node_modules/@capacitor/core/dist/capacitor.js', `${OUT}/js/capacitor.js`);
const html = readFileSync(`${OUT}/index.html`, 'utf8');
const tag = '<script src="js/logic.js"></script>';
if (!html.includes(tag)) throw new Error(`Fant ikke ${tag} i index.html`);
writeFileSync(`${OUT}/index.html`, html.replace(tag, `<script src="js/capacitor.js"></script>\n  ${tag}`));
console.log(`Kopierte ${FILES.length} filer/mapper til ${OUT}/`);
