// Symbole und Farben der Blöcke (selbst gezeichnet, Linienstil wie die anderen MINT2Go-Apps).
import { LED_IMAGES, NOTES, type Category } from './blocks';

const svg = (inner: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

/** 3 x 3 Lichtpunkte; `on` = Nummern (0–8) der leuchtenden Punkte */
const grid = (on: number[]) =>
  Array.from({ length: 9 }, (_, i) => {
    const x = 4 + (i % 3) * 6;
    const y = 4 + Math.floor(i / 3) * 6;
    return `<rect x="${x}" y="${y}" width="4" height="4" rx="1"${on.includes(i) ? ' fill="currentColor"' : ''}/>`;
  }).join('');

const ICONS: Record<string, string> = {
  start: svg('<path d="M5 21V4"/><path d="M5 4h12l-2.500 4 2.500 4H5"/>'),
  forward: svg('<path d="M12 20V5M6 11l6-6 6 6"/>'),
  backward: svg('<path d="M12 4v15M6 13l6 6 6-6"/>'),
  turnLeft: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h9a6 6 0 0 1 6 6v5"/>'),
  turnRight: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9h-9a6 6 0 0 0-6 6v5"/>'),
  showImage: svg(grid([0, 2, 4, 6, 8])),
  lightOff: svg(`${grid([])}<path d="M3 21 21 3"/>`),
  beep: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.500 9a4 4 0 0 1 0 6"/><path d="M19 6.500a8 8 0 0 1 0 11"/>'),
  wait: svg('<path d="M7 3h10M7 21h10"/><path d="M8 3c0 5 3 6 4 9-1 3-4 4-4 9M16 3c0 5-3 6-4 9 1 3 4 4 4 9"/>'),
  repeat: svg('<path d="M17 2l3 3-3 3"/><path d="M20 5H9a5 5 0 0 0-5 5v1"/><path d="M7 22l-3-3 3-3"/><path d="M4 19h11a5 5 0 0 0 5-5v-1"/>'),
  grip: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.800"/><circle cx="15" cy="6" r="1.800"/><circle cx="9" cy="12" r="1.800"/><circle cx="15" cy="12" r="1.800"/><circle cx="9" cy="18" r="1.800"/><circle cx="15" cy="18" r="1.800"/></svg>',
  minus: svg('<path d="M5 12h14"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  stack: svg('<rect x="3" y="3" width="11" height="6" rx="1.500"/><rect x="7" y="9" width="11" height="6" rx="1.500"/><rect x="10" y="15" width="11" height="6" rx="1.500"/>'),
  play: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.500" stroke-linejoin="round"><path d="M7 4.500v15l13-7.500z"/></svg>',
  step: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.500" stroke-linejoin="round" stroke-linecap="round"><path d="M5 5v14l11-7z"/><path d="M19.500 5v14" fill="none" stroke-width="2.600"/></svg>',
  stop: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.500" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  slow: svg('<path d="M9 6l6 6-6 6"/>'),
  fast: svg('<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>'),
  soundOn: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.500 9a4 4 0 0 1 0 6"/><path d="M19 6.500a8 8 0 0 1 0 11"/>'),
  soundOff: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9.500l5 5M22 9.500l-5 5"/>'),
  // Steuerung
  repeatUntil: svg('<path d="M20 12a8 8 0 1 1-3-6.200"/><path d="M20 3.500v5h-5"/><path d="M8.500 12.500l2.500 2.500 4.500-5"/>'),
  forever: svg('<path d="M12 12c-2-3-3.500-4-5.500-4a4 4 0 0 0 0 8c2 0 3.500-1 5.500-4zm0 0c2 3 3.500 4 5.500 4a4 4 0 0 0 0-8c-2 0-3.500 1-5.500 4z"/>'),
  if: svg('<path d="M12 3v7"/><path d="M12 10l-6 5v6M12 10l6 5v6"/><circle cx="12" cy="3.500" r="1" fill="currentColor"/>'),
  ifCount: svg('<path d="M9.500 4 8 20M16 4l-1.500 16M4.500 9h16M3.500 15h16"/>'),
  // Ereignisse
  whenTap: svg('<path d="M6 3l13 9.500-6 1.200-3.200 6.300z"/>'),
  whenBump: svg('<path d="M3 12h11M10 8l4 4-4 4"/><path d="M19 4v16"/>'),
  // Zähler
  setCount: svg('<ellipse cx="12" cy="12" rx="5" ry="8"/>'),
  addCount: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  // Bedingungen (für die Auswahl im Block)
  condWall: svg('<path d="M3 12h11M10 8l4 4-4 4"/><path d="M19 4v16"/>'),
  condFree: svg('<path d="M3 12h16M14 7l5 5-5 5"/>'),
  // Zähler-Anzeige auf der Bühne
  hash: svg('<path d="M9.500 4 8 20M16 4l-1.500 16M4.500 9h16M3.500 15h16"/>'),
  cursor: svg('<path d="M6 3l13 9.500-6 1.200-3.200 6.300z"/>'),
  ear: svg('<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/><path d="M10.500 9a1.500 1.500 0 0 1 3 0"/>'),
  // Aufgaben
  goal: svg('<path d="M6 21V3"/><path d="M6 4h12l-3 4.500 3 4.500H6"/>'),
  star: svg('<path d="M12 3l2.700 5.600 6.100.8-4.500 4.300 1.100 6.100L12 16.800 6.600 19.800l1.100-6.100L3.200 9.400l6.100-.8z"/>'),
  tasks: svg('<rect x="4" y="3" width="16" height="18" rx="2.500"/><path d="M8.500 9l1.800 1.800 3.200-3.600M8.500 16h7"/>'),
};

export function blockIcon(type: string): string {
  return ICONS[type] ?? '';
}

export function uiIcon(
  name: 'grip' | 'minus' | 'plus' | 'start' | 'stack' | 'play' | 'step' | 'stop' | 'slow' | 'fast' | 'soundOn' | 'soundOff' | 'hash' | 'cursor' | 'ear' | 'goal' | 'star' | 'tasks',
): string {
  return ICONS[name];
}

/** Farbe je Kategorie (aus dem MINT2Go-Logo) */
export const CATEGORY_COLOR: Record<Category, string> = {
  move: '#38b8e8',
  light: '#e01070',
  sound: '#f0a030',
  control: '#98c227',
  event: '#3757a9',
  count: '#4d597c',
};

export function categoryIcon(c: Category): string {
  return { move: ICONS.forward, light: ICONS.showImage, sound: ICONS.beep, control: ICONS.repeat, event: ICONS.whenTap, count: ICONS.hash }[c];
}

/** Auswahlwert eines Blocks als Bild/Text für Knopf und Auswahlfenster (Lichtbild, Ton, Bedingung, Vergleich) */
export function choiceHtml(key: string, value: string): string {
  if (key === 'img') return ledSvg(value);
  if (key === 'note') return noteBadge(value);
  if (key === 'cond') return `<span class="cond">${value === 'free' ? ICONS.condFree : ICONS.condWall}</span>`;
  if (key === 'cmp') return `<span class="cmp">${{ lt: '&lt;', eq: '=', gt: '&gt;' }[value] ?? '?'}</span>`;
  return value;
}

/** Lichtmatrix als kleines Bild (5 x 5 Punkte) */
export function ledSvg(id: string): string {
  const rows = LED_IMAGES[id] ?? LED_IMAGES.heart;
  let dots = '';
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      dots += `<rect x="${x * 5 + 0.6}" y="${y * 5 + 0.6}" width="3.8" height="3.8" rx="0.9" fill="currentColor" opacity="${c === '#' ? 1 : 0.14}"/>`;
    });
  });
  return `<svg class="led" viewBox="0 0 25 25" aria-hidden="true">${dots}</svg>`;
}

const NOTE_COLORS: Record<string, string> = { c: '#98c227', d: '#38b8e8', e: '#f0a030', g: '#e01070', a: '#3757a9' };

/** Ton als farbiger Kreis mit dem Notennamen */
export function noteBadge(id: string): string {
  return `<span class="note" style="background:${NOTE_COLORS[id] ?? '#999'}">${NOTES[id]?.name ?? '?'}</span>`;
}
