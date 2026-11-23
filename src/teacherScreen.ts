// Lehrkraft-Bereich (langer Druck auf das Logo): Klassenübersicht mit den gelösten Aufgaben je Kind.
// Hier lassen sich auch der Fortschritt eines Kindes zurücksetzen und ein Kind löschen (jeweils mit Rückfrage).
import { ICONS } from './shared/icons';
import { button, confirmDialog, h, lab } from './shared/dom';
import { escapeText } from './home';
import { LEVELS, TASKS } from './tasks';
import { classOverview, deleteProfile, resetProgress } from './profileStore';

export function teacherScreen(root: HTMLElement, onHome: () => void): () => void {
  root.innerHTML = '';
  const screen = h('div', 'screen teacher');
  const top = h('div', 'live-top');
  top.append(button('tbtn', lab(ICONS.back, 'Start'), onHome, 'Zur Startseite'), h('h1', 'live-title', 'Klassenübersicht'));
  const wrap = h('div', 'cls-wrap');
  screen.append(top, wrap);
  root.append(screen);

  const levelColor = (level: number): string => LEVELS.find((l) => l.id === level)?.color ?? '#999';

  function render(): void {
    wrap.innerHTML = '';
    const rows = classOverview();
    if (!rows.length) {
      wrap.append(h('p', 'cls-empty', 'Noch kein Kind angelegt.'));
      return;
    }
    const table = h('table', 'cls-table');
    const head = h('tr');
    head.append(h('th', 'cls-name', ''));
    TASKS.forEach((t, i) => {
      const th = h('th', 'cls-task', String(i + 1));
      th.style.setProperty('--c', levelColor(t.level));
      th.title = t.title;
      head.append(th);
    });
    head.append(h('th', 'cls-sum', ''), h('th', 'cls-act', ''));
    table.append(head);

    for (const { profile, done } of rows) {
      const tr = h('tr');
      tr.append(h('td', 'cls-name', `<span class="cls-ico">${profile.icon}</span><span class="cls-n">${escapeText(profile.name)}</span>`));
      for (const t of TASKS) {
        const td = h('td', `cls-cell${done.includes(t.id) ? ' ok' : ''}`, done.includes(t.id) ? ICONS.check : '');
        td.style.setProperty('--c', levelColor(t.level));
        tr.append(td);
      }
      const solved = TASKS.filter((t) => done.includes(t.id)).length;
      tr.append(h('td', 'cls-sum', `${solved} / ${TASKS.length}`));
      const act = h('td', 'cls-act');
      act.append(
        button('btool', ICONS.retry, async () => {
          if (!(await confirmDialog(ICONS.retry))) return;
          resetProgress(profile.id);
          render();
        }, 'Fortschritt zurücksetzen'),
        button('btool del', ICONS.trash, async () => {
          if (!(await confirmDialog(ICONS.trash))) return;
          deleteProfile(profile.id);
          render();
        }, 'Kind löschen'),
      );
      tr.append(act);
      table.append(tr);
    }

    // Fuß: wie viele Kinder haben die Aufgabe gelöst
    const foot = h('tr', 'cls-foot');
    foot.append(h('td', 'cls-name', ''));
    for (const t of TASKS) foot.append(h('td', 'cls-cell cnt', String(rows.filter((r) => r.done.includes(t.id)).length)));
    foot.append(h('td', 'cls-sum', ''), h('td', 'cls-act', ''));
    table.append(foot);
    wrap.append(table);
  }

  render();
  return () => undefined;
}
