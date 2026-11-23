// Zeichnung von Hindernissen, Zielfeldern und Sternen auf dem Boden (SVG, Einheit = ein Feld). Für die Bühne und die Karten-Vorschau.
import type { Cell, World } from './sim';

export function obstaclesMarkup(w: World): string {
  return (w.obstacles ?? [])
    .map(
      ([x, y]) =>
        `<g class="obs"><rect x="${x + 0.04}" y="${y + 0.04}" width="0.92" height="0.92" rx="0.14" fill="#4d597c"/>` +
        `<path d="M${x + 0.2} ${y + 0.36}H${x + 0.8}M${x + 0.2} ${y + 0.64}H${x + 0.8}M${x + 0.5} ${y + 0.36}V${y + 0.64}" stroke="#6b7899" stroke-width="0.06" stroke-linecap="round" fill="none"/></g>`,
    )
    .join('');
}

export function goalMarkup(cells: Cell[]): string {
  return cells
    .map(
      ([x, y]) =>
        `<g class="goal"><rect x="${x + 0.05}" y="${y + 0.05}" width="0.9" height="0.9" rx="0.14" fill="#eef7d0" stroke="#98c227" stroke-width="0.07" stroke-dasharray="0.18 0.12"/>` +
        `<path d="M${x + 0.32} ${y + 0.84}V${y + 0.16}" stroke="#4d597c" stroke-width="0.08" stroke-linecap="round"/>` +
        `<path d="M${x + 0.32} ${y + 0.18}L${x + 0.82} ${y + 0.36}L${x + 0.32} ${y + 0.54}Z" fill="#e01070"/></g>`,
    )
    .join('');
}

/** Fünfzackiger Stern um (cx, cy) */
export function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(3)},${(cy + Math.sin(a) * rad).toFixed(3)}`);
  }
  return pts.join(' ');
}

export function starsMarkup(cells: Cell[]): string {
  return cells
    .map(([x, y], i) => `<polygon class="star" data-i="${i}" points="${starPoints(x + 0.5, y + 0.52, 0.36)}" fill="#f0a030" stroke="#d98a12" stroke-width="0.05" stroke-linejoin="round"/>`)
    .join('');
}
