// Live-Programm: Die Kinder sagen die Befehle, die Lehrkraft schreibt sie als große Karten auf (Beamer).
import { ICONS } from './shared/icons';
import { button, h, lab, overlay } from './shared/dom';
import { EXAMPLES } from './examples';
import {
  addStep,
  indexOfStep,
  moveStep,
  removeStep,
  setTitle,
  updateStep,
  emptyProgram,
  MAX_STEPS,
  MAX_TEXT,
  MAX_TITLE,
  type Program,
} from './program';
import type { LiveSession } from './session';
import { STEP_ICONS, stepIcon } from './stepIcons';

export const PLAY_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M7 4.500v15l13-7.500z"/></svg>';
const INSERT_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 18h16"/><path d="M12 9.500v5M9.500 12h5"/></svg>';
const LIST_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.500" cy="6" r="1" fill="currentColor"/><circle cx="4.500" cy="12" r="1" fill="currentColor"/><circle cx="4.500" cy="18" r="1" fill="currentColor"/></svg>';
const UP_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
const DOWN_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';

export { LIST_ICON };

export interface LiveOptions {
  session: LiveSession;
  /** Neue Befehle an dieser Stelle einfügen (z. B. vor einem als Fehler markierten Schritt) */
  insertAt?: number | null;
  /** Hinweis im Eingabefeld, solange eingefügt wird */
  insertHint?: string;
  onHome: () => void;
  onPresent: () => void;
}

/** Baut den Bildschirm in `root` auf. Gibt eine Aufräum-Funktion zurück. */
export function liveScreen(root: HTMLElement, o: LiveOptions): () => void {
  const { session } = o;
  let selectedId: number | null = null;
  let editingId: number | null = null;
  let flashId: number | null = null;
  let insertAt: number | null = o.insertAt ?? null;
  let insertHint = o.insertHint ?? '';
  let entryIcon: string | null = null;

  root.innerHTML = '';
  const screen = h('div', 'screen live');

  // ----- Kopfleiste -----
  const top = h('div', 'live-top');
  const backBtn = button('tbtn', lab(ICONS.back, 'Start'), o.onHome, 'Zur Startseite');
  const title = h('input', 'live-title');
  title.type = 'text';
  title.maxLength = MAX_TITLE;
  title.placeholder = 'Titel des Programms (z. B. Wasser trinken)';
  title.autocomplete = 'off';
  title.setAttribute('enterkeyhint', 'done');
  const undoBtn = button('tbtn', lab(ICONS.undo, 'Zurück'), () => doUndo(), 'Rückgängig');
  const redoBtn = button('tbtn', lab(ICONS.redo, 'Wieder'), () => doRedo(), 'Wiederholen');
  const exBtn = button('tbtn', lab(ICONS.folder, 'Beispiele'), () => void openExamples(), 'Beispiele');
  const newBtn = button('tbtn', lab(ICONS.canvas, 'Neu'), () => startNew(), 'Neues Programm');
  const playBtn = button('tbtn play', lab(PLAY_ICON, 'Vorführen'), () => present(), 'Programm vorführen');
  top.append(backBtn, title, undoBtn, redoBtn, exBtn, newBtn, playBtn);

  // ----- Eingabe -----
  const entry = h('div', 'live-entry');
  const iconBtn = button('ebtn', '', () => void chooseEntryIcon(), 'Symbol wählen');
  const input = h('input', 'live-input');
  input.type = 'text';
  input.maxLength = MAX_TEXT;
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'sentences');
  input.setAttribute('enterkeyhint', 'done');
  const addBtn = button('ebtn add', ICONS.check, () => add(), 'Befehl aufschreiben');
  entry.append(iconBtn, input, addBtn);

  const list = h('div', 'live-list');
  screen.append(top, entry, list);
  root.append(screen);

  // ----- Verhalten -----
  const commit = (p: Program): void => {
    session.commit(p);
  };

  function present(): void {
    if (!session.program.steps.length) return shake(playBtn);
    o.onPresent();
  }

  function shake(el: HTMLElement): void {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  function add(): void {
    const { program, id } = addStep(session.program, input.value, entryIcon, insertAt ?? undefined);
    if (id === null) {
      shake(input.value.trim() ? addBtn : input);
      input.focus();
      return;
    }
    commit(program);
    if (insertAt !== null) insertAt += 1;
    input.value = '';
    entryIcon = null;
    selectedId = null;
    flashId = id;
    refresh();
    scrollToStep(id);
    input.focus(); // direkt im Tipp, sonst blendet das iPad die Tastatur aus
  }

  function scrollToStep(id: number): void {
    const el = list.querySelector<HTMLElement>(`[data-id="${id}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function doUndo(): void {
    if (session.undo()) {
      selectedId = null;
      editingId = null;
      insertAt = null;
      refresh();
    }
  }
  function doRedo(): void {
    if (session.redo()) {
      selectedId = null;
      editingId = null;
      insertAt = null;
      refresh();
    }
  }

  function startNew(): void {
    if (!session.program.steps.length && !session.program.title) return;
    commit(emptyProgram());
    selectedId = null;
    editingId = null;
    insertAt = null;
    insertHint = '';
    title.value = '';
    refresh();
    input.focus();
  }

  async function chooseEntryIcon(): Promise<void> {
    const r = await pickIcon(entryIcon);
    if (r !== undefined) {
      entryIcon = r;
      refresh();
    }
    input.focus();
  }

  async function openExamples(): Promise<void> {
    const ex = await pickExample();
    if (!ex) return;
    commit(ex.build());
    selectedId = null;
    editingId = null;
    insertAt = null;
    insertHint = '';
    title.value = session.program.title;
    refresh();
  }

  title.addEventListener('change', () => {
    commit(setTitle(session.program, title.value));
    refresh();
  });
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.focus();
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  });

  const onKey = (e: KeyboardEvent): void => {
    if (document.querySelector('.overlay')) return; // Fenster offen
    const inField = (e.target as HTMLElement | null)?.tagName === 'INPUT';
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      present();
    } else if (!inField && mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
    } else if (!inField && mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      doRedo();
    } else if (!inField && e.key === 'Escape') {
      selectedId = null;
      insertAt = null;
      insertHint = '';
      refresh();
    }
  };
  document.addEventListener('keydown', onKey);

  // ----- Darstellung -----
  function refresh(): void {
    const p = session.program;
    if (document.activeElement !== title) title.value = p.title;
    undoBtn.disabled = !session.canUndo;
    redoBtn.disabled = !session.canRedo;
    playBtn.classList.toggle('off', !p.steps.length);
    newBtn.classList.toggle('off', !p.steps.length && !p.title);
    iconBtn.innerHTML = entryIcon ? stepIcon(entryIcon) : `<span class="ph">${ICONS.picture}</span>`;
    iconBtn.classList.toggle('has', !!entryIcon);
    const full = p.steps.length >= MAX_STEPS;
    addBtn.disabled = full;
    input.disabled = full;
    input.placeholder = full
      ? 'Das Programm ist voll'
      : insertAt !== null
        ? (insertHint || `Neuer Befehl kommt an Platz ${insertAt + 1}`)
        : p.steps.length
          ? 'Nächster Befehl …'
          : 'Erster Befehl …';
    renderList();
  }

  function renderList(): void {
    const p = session.program;
    const keepScroll = list.scrollTop;
    list.innerHTML = '';
    if (!p.steps.length) {
      list.append(
        h(
          'div',
          'live-empty',
          `<div class="empty-ico">${LIST_ICON}</div><div class="empty-t">Die Kinder sagen die Befehle,<br>du schreibst sie hier auf.</div>`,
        ),
      );
      return;
    }
    const frag = document.createDocumentFragment();
    p.steps.forEach((_, i) => {
      if (insertAt === i) frag.append(insertMarker());
      frag.append(stepCard(p, i));
    });
    if (insertAt !== null && insertAt >= p.steps.length) frag.append(insertMarker());
    list.append(frag);
    list.scrollTop = keepScroll;
    flashId = null;
  }

  function insertMarker(): HTMLElement {
    const m = h('div', 'insert-marker', `<span class="im-line"></span><span class="im-ico">${INSERT_ICON}</span><span class="im-line"></span>`);
    m.append(
      button(
        'im-x',
        ICONS.cross,
        () => {
          insertAt = null;
          insertHint = '';
          refresh();
          input.focus();
        },
        'Nicht hier einfügen',
      ),
    );
    return m;
  }

  function stepCard(p: Program, i: number): HTMLElement {
    const s = p.steps[i];
    const sel = selectedId === s.id;
    const card = h('div', `step${sel ? ' sel' : ''}${s.bug ? ' bug' : ''}${flashId === s.id ? ' pop' : ''}`);
    card.dataset.id = String(s.id);
    const row = h('div', 'step-row');
    row.append(h('span', 'num', String(i + 1)));
    row.append(h('span', `sico${s.icon ? '' : ' none'}`, stepIcon(s.icon)));
    if (editingId === s.id) {
      const ed = h('input', 'step-edit');
      ed.type = 'text';
      ed.maxLength = MAX_TEXT;
      ed.value = s.text;
      ed.setAttribute('enterkeyhint', 'done');
      const done = (save: boolean): void => {
        if (editingId !== s.id) return;
        editingId = null;
        if (save) commit(updateStep(session.program, s.id, { text: ed.value }));
        refresh();
      };
      ed.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          done(true);
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          done(false);
        }
      });
      ed.addEventListener('blur', () => done(true));
      row.append(ed);
      queueMicrotask(() => {
        ed.focus();
        ed.select();
      });
    } else {
      row.append(h('span', 'stxt', escapeHtml(s.text)));
    }
    if (s.bug) {
      row.append(
        button(
          'bugflag',
          stepIcon('bug'),
          (ev) => {
            ev.stopPropagation();
            commit(updateStep(session.program, s.id, { bug: false }));
            refresh();
          },
          'Fehler-Markierung entfernen',
        ),
      );
    }
    card.append(row);
    card.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.tools, .step-edit, .bugflag')) return;
      selectedId = sel ? null : s.id;
      editingId = null;
      refresh();
    });

    if (sel && editingId !== s.id) {
      const tools = h('div', 'tools');
      tools.append(
        toolBtn(UP_ICON, 'Nach oben', i === 0, () => {
          commit(moveStep(session.program, s.id, -1));
          refresh();
          scrollToStep(s.id);
        }),
        toolBtn(DOWN_ICON, 'Nach unten', i === p.steps.length - 1, () => {
          commit(moveStep(session.program, s.id, 1));
          refresh();
          scrollToStep(s.id);
        }),
        toolBtn(ICONS.pen, 'Ändern', false, () => {
          editingId = s.id;
          refresh();
        }),
        toolBtn(ICONS.picture, 'Symbol', false, () => {
          void pickIcon(s.icon).then((r) => {
            if (r !== undefined) commit(updateStep(session.program, s.id, { icon: r }));
            refresh();
          });
        }),
        toolBtn(INSERT_ICON, 'Danach einfügen', false, () => {
          insertAt = indexOfStep(session.program, s.id) + 1;
          insertHint = '';
          selectedId = null;
          refresh();
          input.focus();
        }),
        toolBtn(stepIcon('bug'), s.bug ? 'Fehler weg' : 'Fehler', false, () => {
          commit(updateStep(session.program, s.id, { bug: !s.bug }));
          refresh();
        }, 'bugtool'),
        toolBtn(ICONS.trash, 'Löschen', false, () => {
          commit(removeStep(session.program, s.id));
          selectedId = null;
          if (insertAt !== null) insertAt = Math.min(insertAt, session.program.steps.length);
          refresh();
        }, 'del'),
      );
      card.append(tools);
    }
    return card;
  }

  function toolBtn(icon: string, label: string, disabled: boolean, fn: () => void, extra = ''): HTMLButtonElement {
    const b = button(`tool ${extra}`.trim(), lab(icon, label), (ev) => {
      ev.stopPropagation();
      fn();
    }, label);
    b.disabled = disabled;
    return b;
  }

  refresh();
  if (insertAt === null) {
    // Neuer Start: Eingabe bereit (am PC sofort tippen)
    if (!session.program.steps.length) queueMicrotask(() => input.focus());
  } else {
    queueMicrotask(() => {
      input.focus();
      const marker = list.querySelector('.insert-marker');
      marker?.scrollIntoView({ block: 'center' });
    });
  }

  return () => document.removeEventListener('keydown', onKey);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Symbol wählen. undefined = abgebrochen, null = kein Symbol. */
function pickIcon(current: string | null): Promise<string | null | undefined> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const done = (v: string | null | undefined) => {
      o.close();
      resolve(v);
    };
    const panel = h('div', 'panel pick-panel');
    const head = h('div', 'panel-head');
    head.append(h('h2', '', 'Symbol'), button('tbtn close', ICONS.cross, () => done(undefined), 'Schließen'));
    const grid = h('div', 'icon-grid');
    grid.append(button(`ipick${current === null ? ' on' : ''}`, lab(ICONS.cross, 'Keins'), () => done(null), 'Kein Symbol'));
    for (const ic of STEP_ICONS) {
      grid.append(button(`ipick${current === ic.id ? ' on' : ''}`, lab(ic.svg, ic.name), () => done(ic.id), ic.name));
    }
    panel.append(head, grid);
    o.root.append(panel);
    o.root.addEventListener('click', (e) => {
      if (e.target === o.root) done(undefined);
    });
  });
}

function pickExample(): Promise<(typeof EXAMPLES)[number] | null> {
  return new Promise((resolve) => {
    const o = overlay('overlay-dim');
    const done = (v: (typeof EXAMPLES)[number] | null) => {
      o.close();
      resolve(v);
    };
    const panel = h('div', 'panel pick-panel');
    const head = h('div', 'panel-head');
    head.append(h('h2', '', 'Beispiele'), button('tbtn close', ICONS.cross, () => done(null), 'Schließen'));
    const grid = h('div', 'ex-grid');
    for (const ex of EXAMPLES) {
      const n = ex.build().steps.length;
      grid.append(
        button('ex-card', `<span class="ex-ico">${stepIcon(ex.icon)}</span><span class="ex-t">${escapeHtml(ex.title)}</span><span class="ex-n">${n} Schritte</span>`, () => done(ex), ex.title),
      );
    }
    panel.append(head, grid);
    o.root.append(panel);
    o.root.addEventListener('click', (e) => {
      if (e.target === o.root) done(null);
    });
  });
}
