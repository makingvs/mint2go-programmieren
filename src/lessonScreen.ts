// Unterricht (Lehrkraft, Beamer): Auswahl der Lektionen und Folien-Ansicht.
import { ICONS } from './shared/icons';
import { button, h, lab } from './shared/dom';
import { blockDef, paramLabel } from './blocks';
import { blockIcon, CATEGORY_COLOR, choiceHtml } from './blockIcons';
import { LESSONS, clampSlide, type Lesson, type SlideAction, type VisualBlock } from './lesson';
import { escapeHtml } from './liveEditor';

export interface LessonListOptions {
  onHome: () => void;
  onOpen: (lessonId: string) => void;
}

export function lessonListScreen(root: HTMLElement, o: LessonListOptions): () => void {
  root.innerHTML = '';
  const screen = h('div', 'screen lessons');
  const top = h('div', 'live-top');
  top.append(button('tbtn', lab(ICONS.back, 'Start'), o.onHome, 'Zur Startseite'), h('h1', 'live-title', 'Unterricht'));
  const list = h('div', 'lesson-list');
  LESSONS.forEach((l, i) => {
    const card = button(
      'lesson-card',
      `<span class="lc-n">${i + 1}</span><span class="lc-b"><span class="lc-t">${escapeHtml(l.title)}</span><span class="lc-g">${escapeHtml(l.goal)}</span><span class="lc-m">${l.slides.length} Folien · ca. ${l.minutes} Minuten</span></span>`,
      () => o.onOpen(l.id),
      l.title,
    );
    list.append(card);
  });
  screen.append(top, list);
  root.append(screen);
  return () => undefined;
}

/** Beispiel aus Blöcken (Anzeige): oberste Ebene nebeneinander, Inhalt von Wiederholen & Co. im Kasten. */
export function visualEl(items: VisualBlock[]): HTMLElement {
  const row = h('div', 'mv-row');
  for (const it of items) row.append(visualBlock(it));
  return row;
}

function visualBlock(it: VisualBlock): HTMLElement {
  const def = blockDef(it.type);
  const el = h('div', `mv${it.children ? ' box' : ''}`);
  el.style.setProperty('--c', CATEGORY_COLOR[def?.category ?? 'move']);
  const head = h('div', 'mv-head', `<span class="mv-ico">${blockIcon(it.type)}</span>`);
  for (const d of def?.params ?? []) {
    const v = it.params?.[d.key] ?? d.def;
    head.append(h('span', `mv-chip p-${d.key}`, d.kind === 'choice' ? choiceHtml(d.key, String(v)) : paramLabel(d, v)));
  }
  el.append(head);
  if (it.children) {
    const inner = visualEl(it.children);
    inner.classList.add('mv-in');
    el.append(inner);
  }
  return el;
}

export interface SlideOptions {
  lesson: Lesson;
  index: number;
  onList: () => void;
  /** Taste auf einer Folie: in die App springen (aktuelle Folie wird mitgegeben, damit man zurückkommt) */
  onAction: (a: SlideAction, index: number) => void;
}

export function slideScreen(root: HTMLElement, o: SlideOptions): () => void {
  const slides = o.lesson.slides;
  let index = clampSlide(o.index, slides.length);
  let showNotes = false;

  root.innerHTML = '';
  const screen = h('div', 'screen slides');
  const top = h('div', 'pres-top');
  const title = h('h1', 'pres-title');
  const notesBtn = button('tbtn', lab(ICONS.info, 'Notizen'), () => toggleNotes(), 'Hinweise für die Lehrkraft');
  top.append(button('tbtn', lab(ICONS.back, 'Lektionen'), o.onList, 'Zur Lektionsliste'), title, notesBtn);
  const stage = h('div', 'slide-stage');
  const notes = h('div', 'slide-notes');
  const controls = h('div', 'pres-controls');
  const backBtn = button('pbtn back', lab(ICONS.back, 'Zurück'), () => go(-1), 'Vorherige Folie');
  const dots = h('div', 'slide-dots');
  const nextBtn = button('pbtn next', lab(ICONS.check, 'Weiter'), () => go(1), 'Nächste Folie');
  controls.append(backBtn, dots, nextBtn);
  screen.append(top, stage, notes, controls);
  root.append(screen);

  function go(delta: number): void {
    const n = clampSlide(index + delta, slides.length);
    if (n === index) return;
    index = n;
    render(true);
  }

  function toggleNotes(): void {
    showNotes = !showNotes;
    render(false);
  }

  const onKey = (e: KeyboardEvent): void => {
    if (document.querySelector('.overlay')) return;
    switch (e.key) {
      case ' ':
      case 'Enter':
      case 'ArrowRight':
      case 'PageDown': // Präsentations-Fernbedienung
        e.preventDefault();
        go(1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        go(-1);
        break;
      case 'n':
      case 'N':
        toggleNotes();
        break;
      case 'Escape':
        o.onList();
        break;
    }
  };
  document.addEventListener('keydown', onKey);

  function render(animate: boolean): void {
    const s = slides[index];
    title.textContent = `${o.lesson.title}`;
    backBtn.disabled = index === 0;
    nextBtn.disabled = index === slides.length - 1;
    notesBtn.classList.toggle('on', showNotes);

    stage.innerHTML = '';
    const card = h('div', `slide${animate ? ' in' : ''}`);
    card.append(h('div', 'slide-count', `${index + 1} / ${slides.length}`), h('h2', 'slide-title', escapeHtml(s.title)), h('p', 'slide-text', escapeHtml(s.text)));
    if (s.visual) {
      const v = h('div', 'slide-visual');
      v.append(visualEl(s.visual));
      card.append(v);
    }
    if (s.keep) card.append(h('div', 'slide-keep', `${ICONS.check}<span>${escapeHtml(s.keep)}</span>`));
    if (s.action) {
      const a = s.action;
      card.append(button('slide-action', `${actionIcon(a)}<span>${escapeHtml(a.label)}</span>`, () => o.onAction(a, index), a.label));
    }
    stage.append(card);

    notes.hidden = !showNotes;
    notes.textContent = s.notes;
    dots.innerHTML = '';
    slides.forEach((_, i) => dots.append(h('span', `dot${i < index ? ' done' : i === index ? ' now' : ''}`)));
  }

  render(false);
  return () => document.removeEventListener('keydown', onKey);
}

function actionIcon(a: SlideAction): string {
  if (a.kind === 'live') return ICONS.pen;
  if (a.kind === 'blocks') return blockIcon('stack');
  return blockIcon('tasks');
}
