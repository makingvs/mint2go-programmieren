// Vorführen: Ein Kind macht das Programm, die Lehrkraft schaltet Schritt für Schritt weiter (Beamer).
import { ICONS } from './shared/icons';
import { button, h, lab } from './shared/dom';
import { escapeHtml } from './liveEditor';
import { runBack, runFinished, runNext, runStart, type Program } from './program';
import { stepIcon } from './stepIcons';

export interface PresenterOptions {
  program: Program;
  onEdit: () => void;
  /** Schritt klappt nicht: Index des Schritts (Fehlersuche im Editor) */
  onBug: (index: number) => void;
}

const CONFETTI_COLORS = ['#98c227', '#f0a030', '#e01070', '#38b8e8', '#3757a9'];

/** Baut den Bildschirm in `root` auf. Gibt eine Aufräum-Funktion zurück. */
export function presenterScreen(root: HTMLElement, o: PresenterOptions): () => void {
  const steps = o.program.steps;
  let run = runStart();

  root.innerHTML = '';
  const screen = h('div', 'screen present');
  const top = h('div', 'pres-top');
  top.append(
    button('tbtn', lab(ICONS.pen, 'Bearbeiten'), () => o.onEdit(), 'Zurück zum Bearbeiten'),
    h('h1', 'pres-title', escapeHtml(o.program.title || 'Unser Programm')),
    button('tbtn', lab(ICONS.retry, 'Von vorn'), () => restart(), 'Von vorn beginnen'),
  );
  const main = h('div', 'pres-main');
  const list = h('div', 'pres-list');
  const stage = h('div', 'pres-stage');
  main.append(list, stage);
  const controls = h('div', 'pres-controls');
  const backBtn = button('pbtn back', lab(ICONS.back, 'Zurück'), () => back(), 'Einen Schritt zurück');
  const failBtn = button('pbtn fail', lab(ICONS.cross, 'Klappt nicht'), () => fail(), 'Dieser Schritt klappt nicht');
  const nextBtn = button('pbtn next', lab(ICONS.check, 'Gemacht'), () => next(), 'Schritt ist gemacht');
  controls.append(backBtn, failBtn, nextBtn);
  screen.append(top, main, controls);
  root.append(screen);

  const finished = (): boolean => runFinished(run, steps.length);

  function next(): void {
    if (finished()) return;
    run = runNext(run, steps.length);
    render(true);
  }
  function back(): void {
    run = runBack(run);
    render(true);
  }
  function restart(): void {
    run = runStart();
    render(true);
  }
  function fail(): void {
    if (finished()) return;
    o.onBug(run.index);
  }

  const onKey = (e: KeyboardEvent): void => {
    if (document.querySelector('.overlay')) return;
    switch (e.key) {
      case ' ':
      case 'Enter':
      case 'ArrowRight':
      case 'PageDown': // Präsentations-Fernbedienung
        e.preventDefault();
        next();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        back();
        break;
      case 'x':
      case 'X':
        e.preventDefault(); // sonst landet das "x" im Eingabefeld des Editors
        fail();
        break;
      case 'Escape':
        o.onEdit();
        break;
    }
  };
  document.addEventListener('keydown', onKey);

  function render(animate: boolean): void {
    const fin = finished();
    backBtn.disabled = run.index === 0;
    failBtn.classList.toggle('off', fin);
    nextBtn.classList.toggle('off', fin);
    screen.classList.toggle('fin', fin);

    // Liste links
    list.innerHTML = '';
    steps.forEach((s, i) => {
      const state = i < run.index ? 'done' : i === run.index ? 'now' : 'todo';
      const row = h('div', `pl ${state}${s.bug ? ' bug' : ''}`);
      row.append(
        h('span', 'pl-mark', state === 'done' ? ICONS.check : String(i + 1)),
        h('span', 'pl-ico', stepIcon(s.icon)),
        h('span', 'pl-txt', escapeHtml(s.text)),
      );
      list.append(row);
    });
    list.querySelector('.pl.now')?.scrollIntoView({ block: 'center', behavior: animate ? 'smooth' : 'auto' });
    if (fin) list.scrollTo({ top: list.scrollHeight, behavior: animate ? 'smooth' : 'auto' });

    // Bühne rechts
    stage.innerHTML = '';
    if (fin) {
      const done = h('div', 'pres-done in');
      done.append(h('div', 'done-star', stepIcon('star')), h('div', 'done-t', 'Geschafft!'));
      const row = h('div', 'done-row');
      row.append(
        button('pbtn', lab(ICONS.retry, 'Nochmal'), () => restart(), 'Nochmal'),
        button('pbtn', lab(ICONS.pen, 'Bearbeiten'), () => o.onEdit(), 'Bearbeiten'),
      );
      done.append(row);
      stage.append(done, confetti());
      return;
    }
    const s = steps[run.index];
    const card = h('div', `pres-card${animate ? ' in' : ''}`);
    card.append(
      h('div', 'pc-count', `Schritt ${run.index + 1} von ${steps.length}`),
      h('div', `pc-ico${s.icon ? '' : ' none'}`, stepIcon(s.icon)),
      h('div', 'pc-txt', escapeHtml(s.text)),
    );
    const dots = h('div', 'pc-dots');
    steps.forEach((_, i) => dots.append(h('span', `dot${i < run.index ? ' done' : i === run.index ? ' now' : ''}`)));
    card.append(dots);
    stage.append(card);
  }

  if (!steps.length) queueMicrotask(() => o.onEdit());
  else render(false);

  return () => document.removeEventListener('keydown', onKey);
}

export function confetti(): HTMLElement {
  const c = h('div', 'confetti');
  for (let i = 0; i < 46; i++) {
    const p = h('span', 'cf');
    p.style.left = `${(i * 37) % 100}%`;
    p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    p.style.animationDelay = `${((i * 53) % 100) / 60}s`;
    p.style.animationDuration = `${2.4 + ((i * 29) % 100) / 60}s`;
    p.style.setProperty('--dx', `${((i * 41) % 21) - 10}vw`);
    p.style.setProperty('--rot', `${(i * 71) % 360}deg`);
    c.append(p);
  }
  return c;
}
