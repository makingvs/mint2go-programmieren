// QR-Karte: schwarzer QR-Code auf Weiß mit zweizeiliger Beschriftung darunter (HTML-Vorlage; PNG mit Edge/Chrome headless rendern).
// Aufruf: node scripts/make-qr-card.mjs <Adresse> <Ausgabe ohne Endung> "<Zeile 1>" "<Zeile 2>" [--m=Pixel je Modul] [--w=Breite --h=Höhe] [--font=Schriftgröße]
// Vorlage-Größe (370 x 430 Pixel): --m=9 --w=370 --h=430 --font=21
import fs from 'node:fs';
import { qrMatrix } from './make-qr.mjs';

const opt = Object.fromEntries(process.argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [, , url, out, line1 = '', line2 = ''] = process.argv.filter((a) => !a.startsWith('--') || a === process.argv[1]);
if (!url || !out) {
  console.error('Aufruf: node scripts/make-qr-card.mjs <Adresse> <Ausgabe ohne Endung> "<Zeile 1>" "<Zeile 2>"');
  process.exit(1);
}
const g = qrMatrix(url);
const M = Number(opt.m) || 29; // Pixel je Modul
const FONT = Number(opt.font) || 60;
const QUIET = 4 * M;
const size = g.length * M;
const W = Number(opt.w) || Math.ceil((size + 2 * QUIET) / 40) * 40;
const x0 = Math.round((W - size) / 2);
const y0 = QUIET;
const LH = Math.round(FONT * 1.23);
const capY = y0 + size + Math.round(FONT * 1.15);
const H = Number(opt.h) || capY + 2 * LH + Math.round(FONT);
let rects = '';
g.forEach((row, r) => {
  for (let c = 0; c < row.length; ) {
    if (!row[c]) { c++; continue; }
    let e = c;
    while (e < row.length && row[e]) e++;
    rects += `M${x0 + c * M} ${y0 + r * M}h${(e - c) * M}v${M}h${-(e - c) * M}z`;
    c = e;
  }
});
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><html lang="de"><meta charset="utf-8"><title>QR</title>
<style>html,body{margin:0;width:${W}px;height:${H}px;background:#fff;overflow:hidden}
svg{display:block}text{font-family:'Segoe UI','Open Sans',Arial,sans-serif;font-weight:700;font-size:${FONT}px;fill:#000;text-anchor:middle}</style>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
<rect width="${W}" height="${H}" fill="#fff"/><path d="${rects}" fill="#000"/>
<g shape-rendering="auto"><text x="${W / 2}" y="${capY}">${esc(line1)}</text><text x="${W / 2}" y="${capY + LH}">${esc(line2)}</text></g></svg></html>`;
fs.writeFileSync(`${out}.html`, html);
// reiner QR-Code als SVG (ohne Text, schwarz, mit Ruhezone)
const n = g.length + 8;
let d = '';
g.forEach((row, r) => { for (let c = 0; c < row.length; ) { if (!row[c]) { c++; continue; } let e = c; while (e < row.length && row[e]) e++; d += `M${c + 4} ${r + 4}h${e - c}v1h${-(e - c)}z`; c = e; } });
fs.writeFileSync(`${out}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>\n`);
console.log(`${url}: ${g.length}x${g.length} Module, Karte ${W}x${H}`);
