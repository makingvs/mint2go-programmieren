// Bausteine der Aufgaben-Oberfläche: Karten-Vorschau, Bedingungs-Symbole, Aufgaben-Fenster und Erfolgs-Fenster.
import { ICONS } from './shared/icons';
import { button, h, lab, overlay } from './shared/dom';
import { blockIcon, ledSvg } from './blockIcons';
import { confetti } from './presenter';
import { goalMarkup, obstaclesMarkup, starsMarkup } from './scene';
import type { CheckResult, Req, Task, TaskResult } from './tasks';
import { requirements } from './tasks';

/** Kleine Karte der Aufgabe (Gitter, Hindernisse, Ziel, Sterne, Start mit Blickrichtung). */
export function mapPreview(t: Task): string {
  let grid = '';
  for (let x = 1; x < t.world.w; x++) grid += `M${x} 0V${t.world.h}`;
  for (let y = 1; y < t.world.h; y++) grid += `M0 ${y}H${t.world.w}`;
  const s = t.world.start;
  return (
    `<svg class="mini" viewBox="0 0 ${t.world.w} ${t.world.h}" aria-hidden="true">` +
    `<rect width="${t.world.w}" height="${t.world.h}" fill="#fbfcfe"/>` +
    `<path d="${grid}" stroke="#e3e8f1" stroke-width="0.05" fill="none"/>` +
    goalMarkup(t.goal) +
    obstaclesMarkup(t.world) +
    starsMarkup(t.stars) +
    `<g transform="translate(${s.x} ${s.y}) rotate(${s.heading})"><circle r="0.46" fill="#fff" stroke="#3757a9" stroke-width="0.11"/><path d="M-0.2 0.12L0 -0.34L0.2 0.12Z" fill="#f0a030"/></g>` +
    `</svg>`
  );
}

function iconHtml(r: Req): string {
  return r.img ? ledSvg(r.img) : blockIcon(r.icon);
}

export type ReqState = 'todo' | 'ok' | 'no';

/** Symbol einer Bedingung (mit kleiner Zahl); der Zustand färbt es und zeigt Haken bzw. Kreuz. */
export function reqChip(r: Req, state: ReqState = 'todo'): HTMLElement {
  const el = h('span', 'req-chip', `<span class="rc-ico">${iconHtml(r)}</span>${r.badge ? `<span class="rc-badge">${r.badge}</span>` : ''}`);
  el.dataset.state = state;
  el.dataset.id = r.id;
  el.title = r.label;
  return el;
}

/** Zustand der Symbole aus einem Prüfergebnis setzen (null = noch nicht geprüft). */
export function paintChips(chips: HTMLElement[], res: TaskResult | null): void {
  for (const c of chips) {
    const r: CheckResult | undefined = res?.checks.find((x) => x.id === c.dataset.id);
    c.dataset.state = !r ? 'todo' : r.ok ? 'ok' : 'no';
  }
}

/** Fenster mit der Aufgabe: Text, Karte und was verlangt wird. Fertig, wenn es geschlossen wird. */
export function openTaskInfo(t: Task, res: TaskResult | null = null): Promise<void> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const done = (): void => {
      o.close();
      resolve();
    };
    const card = h('div', 'task-card');
    const head = h('div', 'tc-head');
    head.append(h('span', 'tc-ico', blockIcon('tasks')), h('h2', 'tc-title', t.title));
    const body = h('div', 'tc-body');
    const map = h('div', 'tc-map', mapPreview(t));
    const side = h('div', 'tc-side');
    side.append(h('p', 'tc-text', t.text));
    const list = h('div', 'tc-reqs');
    for (const r of requirements(t)) {
      const row = h('div', 'tc-req');
      const state = res?.checks.find((c) => c.id === r.id);
      row.append(reqChip(r, !state ? 'todo' : state.ok ? 'ok' : 'no'), h('span', 'tc-rl', r.label));
      list.append(row);
    }
    side.append(list);
    body.append(map, side);
    const go = button('big-btn yes', ICONS.check, done, 'Los geht’s');
    card.append(head, body, h('div', 'tc-foot'));
    card.querySelector('.tc-foot')!.append(go);
    o.root.append(card);
    o.root.addEventListener('click', (e) => {
      if (e.target === o.root) done();
    });
  });
}

export type SuccessChoice = 'next' | 'list' | 'stay';

/** Geschafft! Weiter zur nächsten Aufgabe, zurück zur Liste oder noch weiter ausprobieren. */
export function openSuccess(t: Task, hasNext: boolean): Promise<SuccessChoice> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const done = (c: SuccessChoice): void => {
      o.close();
      resolve(c);
    };
    const card = h('div', 'success-card');
    card.append(h('div', 'sc-star', blockIcon('star')), h('div', 'sc-t', 'Geschafft!'), h('div', 'sc-s', t.title));
    const row = h('div', 'sc-row');
    row.append(
      button('pbtn', lab(blockIcon('tasks'), 'Aufgaben'), () => done('list'), 'Zur Aufgabenliste'),
      button('pbtn', lab(ICONS.pen, 'Ändern'), () => done('stay'), 'Weiter ausprobieren'),
    );
    if (hasNext) row.append(button('pbtn next', lab(blockIcon('forward').replace('<svg class="icon"', '<svg class="icon" style="transform:rotate(90deg)"'), 'Weiter'), () => done('next'), 'Nächste Aufgabe'));
    card.append(row);
    o.root.append(card, confetti());
    o.root.addEventListener('click', (e) => {
      if (e.target === o.root) done('stay');
    });
  });
}
