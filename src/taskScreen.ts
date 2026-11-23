// Auswahl der Übungsaufgaben: Karten nach Stufen, gelöste Aufgaben mit Haken.
import { ICONS } from './shared/icons';
import { button, h, lab } from './shared/dom';
import { blockIcon } from './blockIcons';
import { escapeText } from './home';
import type { Profile } from './profiles';
import { LEVELS, TASKS } from './tasks';
import { mapPreview } from './taskUi';

export interface TaskScreenOptions {
  profile: Profile;
  onProfiles: () => void;
  done: string[];
  onHome: () => void;
  onOpen: (id: string) => void;
}

export function tasksScreen(root: HTMLElement, o: TaskScreenOptions): () => void {
  root.innerHTML = '';
  const screen = h('div', 'screen tasks');
  const top = h('div', 'live-top');
  const count = TASKS.filter((t) => o.done.includes(t.id)).length;
  top.append(
    button('tbtn', lab(ICONS.back, 'Start'), o.onHome, 'Zur Startseite'),
    h('div', 'bk-title tk-title', `${blockIcon('tasks')}<span class="tk-count"><span class="tk-star">${blockIcon('star')}</span>${count} / ${TASKS.length}</span>`),
    button('who small', `<span class="who-ico">${o.profile.icon}</span><span class="who-n">${escapeText(o.profile.name)}</span>`, o.onProfiles, 'Kind wechseln'),
  );
  const list = h('div', 'task-list');
  for (const lv of LEVELS) {
    const tasks = TASKS.filter((t) => t.level === lv.id);
    if (!tasks.length) continue;
    const sec = h('section', 'tk-level');
    sec.style.setProperty('--c', lv.color);
    const doneHere = tasks.filter((t) => o.done.includes(t.id)).length;
    sec.append(h('h2', 'tk-lh', `<span class="tk-dot"></span>${lv.name}<span class="tk-lc">${doneHere} / ${tasks.length}</span>`));
    const grid = h('div', 'tk-grid');
    for (const t of tasks) {
      const isDone = o.done.includes(t.id);
      const card = button(
        `tk-card${isDone ? ' done' : ''}`,
        `<span class="tk-map">${mapPreview(t)}</span><span class="tk-name"><b>${TASKS.indexOf(t) + 1}</b> ${t.title}</span>${isDone ? `<span class="tk-ok">${ICONS.check}</span>` : ''}`,
        () => o.onOpen(t.id),
        t.title,
      );
      grid.append(card);
    }
    sec.append(grid);
    list.append(sec);
  }
  screen.append(top, list);
  root.append(screen);
  return () => undefined;
}
