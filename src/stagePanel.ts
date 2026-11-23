// Bühne für den Roboter: Boden (SVG), Display wie am Spike-Hub und die Tasten Start/Schritt/Stopp/Tempo/Ton.
import { ICONS } from './shared/icons';
import { button, h, lab } from './shared/dom';
import { uiIcon } from './blockIcons';
import { LED_IMAGES } from './blocks';
import { goalMarkup, obstaclesMarkup, starsMarkup } from './scene';
import { visited, type Cell, type RobotState, type World } from './sim';
import type { Mode } from './simPlayer';

/** Ziele und Sterne einer Aufgabe (Hindernisse stehen in der Welt) */
export interface StageScene {
  goal: Cell[];
  stars: Cell[];
}

export interface StageHandlers {
  onPlay: () => void;
  onStep: () => void;
  onStop: () => void;
  onSpeed: (fast: boolean) => void;
  onSound: (on: boolean) => void;
  /** Roboter oder Display angetippt (Ereignis "Wenn getippt") */
  onTap: () => void;
}

export interface StagePanel {
  el: HTMLElement;
  setState(s: RobotState): void;
  setMode(m: Mode): void;
  /** Roboter ist gegen die Wand gestoßen */
  bump(): void;
  /** Ton wird gespielt (Display blinkt) */
  pulse(): void;
  /** Zähler-Anzeige ein- oder ausblenden (nur wenn das Programm den Zähler benutzt) */
  showCounter(v: boolean): void;
}

const NS = 'http://www.w3.org/2000/svg';
const PIXEL = 0.12; // Größe eines Lichtpunkts auf dem Roboter (Felder)

function lit(image: string | null, x: number, y: number): boolean {
  return !!image && LED_IMAGES[image]?.[y]?.[x] === '#';
}

/** Boden mit Gitter, Start, Spur und Roboter. */
function floorMarkup(w: World, scene?: StageScene): string {
  let grid = '';
  for (let x = 1; x < w.w; x++) grid += `M${x} 0V${w.h}`;
  for (let y = 1; y < w.h; y++) grid += `M0 ${y}H${w.w}`;
  let pixels = '';
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      pixels += `<rect class="px" data-x="${x}" data-y="${y}" x="${(x - 2.5) * PIXEL}" y="${(y - 2.5) * PIXEL - 0.04}" width="${PIXEL * 0.82}" height="${PIXEL * 0.82}" rx="0.02"/>`;
    }
  }
  return (
    `<svg viewBox="0 0 ${w.w} ${w.h}" xmlns="${NS}" aria-hidden="true">` +
    `<rect x="0" y="0" width="${w.w}" height="${w.h}" fill="#fbfcfe"/>` +
    `<path d="${grid}" stroke="#e3e8f1" stroke-width="0.04" fill="none"/>` +
    `<circle cx="${w.start.x}" cy="${w.start.y}" r="0.5" fill="#98c227" opacity="0.22"/>` +
    goalMarkup(scene?.goal ?? []) +
    obstaclesMarkup(w) +
    starsMarkup(scene?.stars ?? []) +
    `<polyline class="trail" points="" fill="none" stroke="#f0a030" stroke-width="0.09" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>` +
    `<g class="robot">` +
    `<circle class="hit" r="0.95" fill="transparent"/>` +
    `<rect x="-0.47" y="-0.33" width="0.15" height="0.52" rx="0.05" fill="#2f3a5f"/>` +
    `<rect x="0.32" y="-0.33" width="0.15" height="0.52" rx="0.05" fill="#2f3a5f"/>` +
    `<rect x="-0.34" y="-0.45" width="0.68" height="0.9" rx="0.12" fill="#ffffff" stroke="#3757a9" stroke-width="0.06"/>` +
    `<path d="M-0.13 -0.45L0 -0.63L0.13 -0.45Z" fill="#f0a030"/>` +
    `<rect x="-0.3" y="-0.36" width="0.6" height="0.6" rx="0.05" fill="#2f3a5f"/>` +
    pixels +
    `</g>` +
    `<rect x="0.04" y="0.04" width="${w.w - 0.08}" height="${w.h - 0.08}" rx="0.1" fill="none" stroke="#3757a9" stroke-width="0.1" class="wall"/>` +
    `</svg>`
  );
}

function hubMarkup(): string {
  let px = '';
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) px += `<rect class="hpx" data-x="${x}" data-y="${y}" x="${x * 5 + 1}" y="${y * 5 + 1}" width="4" height="4" rx="0.8"/>`;
  return `<svg viewBox="0 0 25 25" aria-hidden="true">${px}</svg>`;
}

export function createStagePanel(world: World, handlers: StageHandlers, init: { fast: boolean; sound: boolean }, scene?: StageScene): StagePanel {
  const el = h('div', 'bk-stage');
  const floor = h('div', 'floor', floorMarkup(world, scene));
  const starEls = [...floor.querySelectorAll<SVGElement>('.star')];
  const robot = floor.querySelector<SVGGElement>('.robot')!;
  const trail = floor.querySelector<SVGPolylineElement>('.trail')!;
  const robotPx = [...floor.querySelectorAll<SVGRectElement>('.px')];

  const counter = h('div', 'counter', `${uiIcon('hash')}<span class="cnt">0</span>`);
  counter.hidden = true;
  floor.append(counter);
  const cnt = counter.querySelector<HTMLElement>('.cnt')!;

  const hub = h('div', 'hub', hubMarkup());
  hub.setAttribute('role', 'button');
  hub.setAttribute('aria-label', 'Taste');
  const hubPx = [...hub.querySelectorAll<SVGRectElement>('.hpx')];

  let fast = init.fast;
  let sound = init.sound;
  let mode: Mode = 'idle';

  const playBtn = button('sbtn play', '', () => handlers.onPlay(), 'Start');
  const stepBtn = button('sbtn', lab(uiIcon('step'), 'Schritt'), () => handlers.onStep(), 'Einen Schritt');
  const stopBtn = button('sbtn', lab(uiIcon('stop'), 'Stopp'), () => handlers.onStop(), 'Zurück zum Start');
  const speedBtn = button('sbtn', '', () => {
    fast = !fast;
    paintToggles();
    handlers.onSpeed(fast);
  }, 'Tempo');
  const soundBtn = button('sbtn', '', () => {
    sound = !sound;
    paintToggles();
    handlers.onSound(sound);
  }, 'Ton an oder aus');
  // Antippen von Roboter oder Display = Ereignis "Wenn getippt"
  const tapped = (el: Element, cls: string) => {
    el.classList.remove(cls);
    void (el as HTMLElement).getBoundingClientRect();
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), 300);
    handlers.onTap();
  };
  robot.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tapped(robot, 'tapped');
  });
  hub.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tapped(hub, 'press');
  });

  const btns = h('div', 'ctl-btns');
  btns.append(playBtn, stopBtn, stepBtn, speedBtn, soundBtn);
  const ctl = h('div', 'stage-ctl');
  ctl.append(hub, btns);
  el.append(floor, ctl);

  function paintToggles(): void {
    speedBtn.innerHTML = lab(uiIcon(fast ? 'fast' : 'slow'), 'Tempo');
    soundBtn.innerHTML = lab(uiIcon(sound ? 'soundOn' : 'soundOff'), 'Ton');
    soundBtn.classList.toggle('muted', !sound);
  }

  function setImage(image: string | null): void {
    for (const r of robotPx) r.classList.toggle('on', lit(image, Number(r.dataset.x), Number(r.dataset.y)));
    for (const r of hubPx) r.classList.toggle('on', lit(image, Number(r.dataset.x), Number(r.dataset.y)));
  }

  function setState(s: RobotState): void {
    robot.setAttribute('transform', `translate(${s.x} ${s.y}) rotate(${s.heading})`);
    const pts = s.trail.map(([x, y]) => `${x},${y}`);
    const last = s.trail[s.trail.length - 1];
    if (last && (Math.abs(last[0] - s.x) > 1e-6 || Math.abs(last[1] - s.y) > 1e-6)) pts.push(`${s.x},${s.y}`);
    trail.setAttribute('points', pts.length > 1 ? pts.join(' ') : '');
    setImage(s.image);
    cnt.textContent = String(s.count);
    // Sterne, über die der Roboter gefahren ist, verschwinden
    scene?.stars.forEach((c, i) => starEls[i]?.classList.toggle('got', visited(s, c)));
  }

  function setMode(m: Mode): void {
    mode = m;
    playBtn.innerHTML = m === 'listening' ? lab(uiIcon('ear'), 'Wartet') : lab(m === 'done' ? ICONS.retry : uiIcon('play'), m === 'done' ? 'Nochmal' : 'Start');
    playBtn.disabled = m === 'playing' || m === 'listening';
    stepBtn.disabled = m === 'playing' || m === 'listening';
    stopBtn.disabled = m === 'idle';
    el.dataset.mode = mode;
  }

  function flash(cls: string, ms: number): void {
    floor.classList.remove(cls);
    void floor.offsetWidth;
    floor.classList.add(cls);
    window.setTimeout(() => floor.classList.remove(cls), ms);
  }

  paintToggles();
  setMode('idle');
  return {
    el,
    setState,
    setMode,
    bump: () => flash('bump', 350),
    showCounter: (v) => {
      counter.hidden = !v;
    },
    pulse: () => {
      hub.classList.remove('pulse');
      void hub.offsetWidth;
      hub.classList.add('pulse');
    },
  };
}
