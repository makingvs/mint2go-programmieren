// Blöcke-Editor für die Kinder: Palette links, Programm rechts. Blöcke ziehen oder antippen, Zahlen mit Plus/Minus.
import { ICONS } from './shared/icons';
import { button, confirmDialog, h, lab, overlay } from './shared/dom';
import { blockIcon, categoryIcon, CATEGORY_COLOR, choiceHtml, uiIcon } from './blockIcons';
import {
  BLOCK_DEFS,
  CATEGORIES,
  HAT_PARENT,
  HAT_TYPES,
  addAtCursor,
  addEvent,
  blockDef,
  canInsert,
  canMove,
  clearBlocks,
  duplicateBlock,
  findBlock,
  hasEvent,
  insertBlock,
  isContainer,
  moveBlock,
  paramLabel,
  removeBlock,
  removeEvent,
  setParam,
  usesCounter,
  type Block,
  type BlockProgram,
  type Category,
  type ChoiceParam,
  type HatType,
  type NumParam,
  type ParamDef,
} from './blocks';
import { isMuted, playSound, setMuted, unlockAudio } from './audio';
import { markDone } from './profileStore';
import type { Session } from './session';
import { DEFAULT_WORLD, type Instr } from './sim';
import { SimPlayer, type Mode } from './simPlayer';
import { createStagePanel } from './stagePanel';
import { checkTask, nextTask, requirements, type Task, type TaskResult } from './tasks';
import { openSuccess, openTaskInfo, paintChips, reqChip } from './taskUi';

export interface BlockEditorOptions {
  session: Session<BlockProgram> & { program: BlockProgram };
  onHome: () => void;
  /** Kind, dem die Arbeit gehört (für gelöste Aufgaben) */
  profileId?: string;
  /** Übungsaufgabe: Welt, Ziel/Sterne, erlaubte Blöcke und automatische Prüfung */
  task?: Task;
  onTasks?: () => void;
  onNextTask?: (id: string) => void;
}

type DragSource = { kind: 'new'; type: string } | { kind: 'move'; id: number };

interface Target {
  parent: number | null;
  index: number;
  el: HTMLElement;
}

const DRAG_START = 8; // Pixel, ab denen aus einem Tipp ein Ziehen wird
const SNAP_DIST = 70; // so nah muss der Finger an einer Einfügestelle sein
const SCROLL_EDGE = 64;

/** Baut den Bildschirm in `root` auf. Gibt eine Aufräum-Funktion zurück. */
export function blockScreen(root: HTMLElement, o: BlockEditorOptions): () => void {
  const { session, task } = o;
  const world = task?.world ?? DEFAULT_WORLD;
  /** Block-Typen in der Palette (bei einer Aufgabe nur die erlaubten) */
  const shown = BLOCK_DEFS.filter((d) => !task || task.allowed.includes(d.type));
  const shownCategories = CATEGORIES.filter((c) => shown.some((d) => d.category === c.id));
  let selectedId: number | null = null;
  /** Gewähltes Ereignis-Skript (Kopf angetippt): neue Blöcke aus der Palette kommen hinein */
  let selectedHat: HatType | null = null;
  let tab: Category = shownCategories[0]?.id ?? 'move';
  let cancelDrag: (() => void) | null = null;
  let justDragged = false;
  let celebrateTimer: number | undefined;
  let celebrating = false;

  root.innerHTML = '';
  const screen = h('div', 'screen blocks');

  // ----- Kopfleiste -----
  const top = h('div', 'live-top');
  const backBtn = button('tbtn', task ? lab(ICONS.back, 'Aufgaben') : lab(ICONS.back, 'Start'), o.onHome, task ? 'Zur Aufgabenliste' : 'Zur Startseite');
  const undoBtn = button('tbtn', lab(ICONS.undo, 'Zurück'), () => doUndo(), 'Rückgängig');
  const redoBtn = button('tbtn', lab(ICONS.redo, 'Wieder'), () => doRedo(), 'Wiederholen');
  const clearBtn = button('tbtn', lab(ICONS.trash, 'Leeren'), () => void clearAll(), 'Alle Blöcke löschen');
  const reqChips: HTMLElement[] = [];
  let title: HTMLElement;
  if (task) {
    // Aufgabe: Info-Taste und die Bedingungen als Symbole (grün = erfüllt, grau = noch nicht)
    title = h('div', 'bk-title task-reqs');
    title.append(button('tbtn info', lab(ICONS.info, 'Aufgabe'), () => void openTaskInfo(task, lastResult), 'Aufgabe lesen'));
    for (const r of requirements(task)) {
      const chip = reqChip(r);
      reqChips.push(chip);
      title.append(chip);
    }
  } else title = h('div', 'bk-title', uiIcon('stack'));
  top.append(backBtn, title, undoBtn, redoBtn, clearBtn);

  // ----- Palette und Programm -----
  const main = h('div', 'bk-main');
  const palette = h('div', 'bk-palette');
  const tabs = h('div', 'bk-tabs');
  const items = h('div', 'bk-items');
  palette.append(tabs, items);
  const work = h('div', 'bk-work');
  const prog = h('div', 'bk-prog');
  work.append(prog);

  // ----- Bühne mit dem simulierten Roboter -----
  let runInstr: Instr | null = null; // Anweisung, die gerade läuft (Block wird hervorgehoben)
  let lastResult: TaskResult | null = null;
  const stage = createStagePanel(
    world,
    {
      onPlay: () => {
        if (!hasContent()) return shake(playButton());
        unlockAudio();
        player.play(program());
      },
      onStep: () => {
        if (!hasContent()) return shake(playButton());
        unlockAudio();
        player.step(program());
      },
      onStop: () => player.stop(),
      onSpeed: (fast) => player.setSpeed(fast ? 2.5 : 1),
      onSound: (on) => setMuted(!on),
      onTap: () => {
        // Aufgabe mit "Wenn getippt": geprüft wird erst, wenn der Roboter wirklich angetippt wurde
        if (player.event('tap') && task?.fire?.includes('tap')) scheduleCheck(900);
      },
    },
    { fast: false, sound: !isMuted() },
    task ? { goal: task.goal, stars: task.stars } : undefined,
  );
  const playButton = (): HTMLElement => stage.el.querySelector<HTMLElement>('.sbtn.play')!;
  const player = new SimPlayer(world, {
    onFrame: (s) => stage.setState(s),
    onInstr: (i) => {
      runInstr = i;
      paintRun(true);
    },
    onMode: (m) => {
      stage.setMode(m);
      modeChanged(m);
    },
    onSound: (e) => {
      playSound(e);
      if (e.kind === 'beep') stage.pulse();
      else stage.bump();
    },
  });
  stage.setState(player.state);

  // ----- Aufgabe prüfen -----
  function modeChanged(m: Mode): void {
    if (!task) return;
    if (m === 'idle') {
      window.clearTimeout(celebrateTimer);
      lastResult = null;
      paintChips(reqChips, null);
    } else if ((m === 'done' || m === 'listening') && !task.fire?.includes('tap')) scheduleCheck(600);
  }

  /** Nach kurzer Pause prüfen, damit man die letzte Bewegung noch sieht. */
  function scheduleCheck(ms: number): void {
    window.clearTimeout(celebrateTimer);
    celebrateTimer = window.setTimeout(() => void runCheck(), ms);
  }

  async function runCheck(): Promise<void> {
    if (!task) return;
    const res = checkTask(task, program());
    lastResult = res;
    paintChips(reqChips, res);
    if (!res.passed || celebrating) return;
    if (o.profileId) markDone(o.profileId, task.id);
    celebrating = true;
    const next = nextTask(task.id);
    const choice = await openSuccess(task, !!next);
    celebrating = false;
    if (choice === 'next' && next) o.onNextTask?.(next.id);
    else if (choice === 'list') o.onTasks?.();
  }

  main.append(palette, work, stage.el);
  screen.append(top, main);
  root.append(screen);

  /** Block der laufenden Anweisung hervorheben (und bei Wiederholen den Durchlauf zeigen). */
  function paintRun(scroll: boolean): void {
    for (const e of prog.querySelectorAll('.blk.run, .hat.run')) e.classList.remove('run');
    for (const e of prog.querySelectorAll<HTMLElement>('[data-check]')) delete e.dataset.check;
    for (const e of prog.querySelectorAll<HTMLElement>('.chip-n[data-iter]')) delete e.dataset.iter;
    if (!runInstr) return;
    const el = prog.querySelector<HTMLElement>(`.blk[data-id="${runInstr.id}"], .hat[data-id="${runInstr.id}"]`);
    if (!el) return;
    el.classList.add('run');
    if (runInstr.kind === 'check') el.dataset.check = runInstr.result ? 'yes' : 'no';
    if (runInstr.kind === 'loop') {
      const n = el.querySelector<HTMLElement>(':scope > .blk-head .chip-n');
      if (n) n.dataset.iter = String(runInstr.iter);
    }
    if (scroll) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const program = (): BlockProgram => session.program;
  const hasContent = (): boolean => program().blocks.length > 0 || !!program().events;
  /** Jede Änderung am Programm setzt den Roboter zurück. */
  const commit = (p: BlockProgram): void => {
    if (session.commit(p)) player.stop();
  };

  // ----- Aktionen -----
  function doUndo(): void {
    if (session.undo()) {
      player.stop();
      afterHistory();
    }
  }
  function doRedo(): void {
    if (session.redo()) {
      player.stop();
      afterHistory();
    }
  }
  function afterHistory(): void {
    if (selectedId !== null && !findBlock(program(), selectedId)) selectedId = null;
    if (selectedHat && !hasEvent(program(), selectedHat)) selectedHat = null;
    render();
  }

  async function clearAll(): Promise<void> {
    if (!hasContent()) return;
    if (!(await confirmDialog(ICONS.trash))) return;
    commit(clearBlocks(program()));
    selectedId = null;
    render();
  }

  function shake(el: HTMLElement): void {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  /** Ereignis-Skript anlegen (oder dorthin springen, wenn es das schon gibt) */
  function addHat(hat: HatType, el: HTMLElement | null): void {
    if (hasEvent(program(), hat)) {
      if (el) shake(el);
      prog.querySelector<HTMLElement>(`.hat[data-id="${HAT_PARENT[hat]}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    commit(addEvent(program(), hat));
    selectedId = null;
    selectedHat = hat; // gleich hineinbauen: die nächsten Blöcke aus der Palette kommen in dieses Skript
    render();
    prog.querySelector<HTMLElement>(`.hat[data-id="${HAT_PARENT[hat]}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function removeHat(hat: HatType): Promise<void> {
    if ((program().events?.[hat]?.length ?? 0) > 0 && !(await confirmDialog(ICONS.trash))) return;
    commit(removeEvent(program(), hat));
    if (selectedId !== null && !findBlock(program(), selectedId)) selectedId = null;
    if (selectedHat === hat) selectedHat = null;
    render();
  }

  /** Antippen in der Palette */
  function tapAdd(type: string, el: HTMLElement): void {
    const hat = blockDef(type)?.hat;
    if (hat) return addHat(hat, el);
    const inHat = selectedHat && hasEvent(program(), selectedHat) ? selectedHat : null;
    const r = inHat ? insertBlock(program(), type, HAT_PARENT[inHat], program().events?.[inHat]?.length ?? 0) : addAtCursor(program(), type, selectedId);
    if (r.id === null) return shake(el);
    commit(r.program);
    selectedId = r.id;
    selectedHat = null;
    render();
    scrollToBlock(r.id);
  }

  function scrollToBlock(id: number): void {
    prog.querySelector<HTMLElement>(`.blk[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function deleteBlock(id: number): Promise<void> {
    const f = findBlock(program(), id);
    if (!f) return;
    if (f.block.children?.length && !(await confirmDialog(ICONS.trash))) return;
    commit(removeBlock(program(), id));
    if (selectedId === id || (selectedId !== null && !findBlock(program(), selectedId))) selectedId = null;
    render();
  }

  // ----- Werte ändern -----
  async function editParam(b: Block, d: ParamDef): Promise<void> {
    const cur = b.params[d.key];
    const v = d.kind === 'number' ? await openStepper(b, d, cur as number) : await openChoice(b, d, cur as string);
    if (v === null) return;
    commit(setParam(program(), b.id, d.key, v));
    render();
  }

  // ----- Ziehen -----
  /** Eine Einfügestelle ist nur erlaubt, wenn der Block dort hin darf. */
  function slotAllowed(src: DragSource, slot: HTMLElement, srcEl: HTMLElement | null): boolean {
    if (srcEl && srcEl.contains(slot)) return false; // nicht in den eigenen Inhalt
    const parent = slot.dataset.parent ? Number(slot.dataset.parent) : null;
    return src.kind === 'new' ? canInsert(program(), src.type, parent) : canMove(program(), src.id, parent);
  }

  /**
   * Zeigefinger/Maus auf `el` gedrückt: aus einem Tipp (onTap) wird ab DRAG_START Pixel ein Ziehen.
   * Die Einfügestellen (.slot) liegen im DOM; die nächste zum Finger wird markiert.
   */
  function armDrag(el: HTMLElement, e: PointerEvent, src: DragSource, srcEl: HTMLElement | null, onTap: () => void): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (cancelDrag) return;
    e.preventDefault();
    const pid = e.pointerId;
    const sx = e.clientX;
    const sy = e.clientY;
    let x = sx;
    let y = sy;
    let started = false;
    let ghost: HTMLElement | null = null;
    let target: Target | null = null;
    let overPalette = false;
    let timer: number | undefined;
    try {
      el.setPointerCapture(pid);
    } catch {
      /* nicht überall möglich */
    }
    const type = src.kind === 'new' ? src.type : (findBlock(program(), src.id)?.block.type ?? '');
    const def = blockDef(type);

    const begin = (): void => {
      started = true;
      const color = def ? CATEGORY_COLOR[def.category] : '#999';
      ghost = h('div', 'ghost', blockIcon(type));
      ghost.style.setProperty('--c', color);
      document.body.append(ghost);
      document.body.classList.add('dragging');
      srcEl?.classList.add('ghosted');
      for (const s of work.querySelectorAll<HTMLElement>('.slot')) {
        if (!slotAllowed(src, s, srcEl)) s.dataset.off = '1';
      }
      timer = window.setInterval(update, 30); // auch ohne Bewegung weiter scrollen
    };

    const update = (): void => {
      if (!ghost) return;
      ghost.style.transform = `translate(${x - 36}px, ${y - 36}px)`;
      const pr = palette.getBoundingClientRect();
      overPalette = x >= pr.left && x <= pr.right && y >= pr.top && y <= pr.bottom;
      palette.classList.toggle('del-hot', overPalette && src.kind === 'move');
      const wr = work.getBoundingClientRect();
      if (!overPalette && x >= wr.left && x <= wr.right) {
        if (y < wr.top + SCROLL_EDGE) work.scrollTop -= 14;
        else if (y > wr.bottom - SCROLL_EDGE) work.scrollTop += 14;
      }
      let best: Target | null = null;
      let bestD = SNAP_DIST;
      let bestW = Infinity;
      if (!overPalette && y >= wr.top - 20 && y <= wr.bottom + 20) {
        for (const s of work.querySelectorAll<HTMLElement>('.slot:not([data-off])')) {
          const r = s.getBoundingClientRect();
          if (r.bottom < wr.top - 20 || r.top > wr.bottom + 20) continue;
          const dx = Math.max(r.left - x, 0, x - r.right);
          const dy = Math.max(r.top - y, 0, y - r.bottom);
          const d = Math.hypot(dx, dy);
          if (d < bestD - 0.5 || (Math.abs(d - bestD) <= 0.5 && r.width < bestW)) {
            bestD = d;
            bestW = r.width;
            best = { parent: s.dataset.parent ? Number(s.dataset.parent) : null, index: Number(s.dataset.index), el: s };
          }
        }
      }
      if (best?.el !== target?.el) {
        target?.el.classList.remove('hot');
        best?.el.classList.add('hot');
      }
      target = best;
    };

    const cleanup = (): void => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      try {
        el.releasePointerCapture(pid);
      } catch {
        /* schon losgelassen */
      }
      if (timer !== undefined) clearInterval(timer);
      ghost?.remove();
      document.body.classList.remove('dragging');
      srcEl?.classList.remove('ghosted');
      palette.classList.remove('del-hot');
      for (const s of work.querySelectorAll<HTMLElement>('.slot')) {
        s.classList.remove('hot');
        delete s.dataset.off;
      }
      cancelDrag = null;
    };

    const move = (ev: PointerEvent): void => {
      if (ev.pointerId !== pid) return;
      x = ev.clientX;
      y = ev.clientY;
      if (!started && Math.hypot(x - sx, y - sy) > DRAG_START) begin();
      if (started) update();
    };

    const up = (ev: PointerEvent): void => {
      if (ev.pointerId !== pid) return;
      const wasStarted = started;
      const t = target;
      const toPalette = overPalette;
      cleanup();
      if (!wasStarted) return onTap();
      justDragged = true; // das folgende click-Ereignis soll nichts auswählen
      window.setTimeout(() => (justDragged = false), 80);
      if (src.kind === 'move' && toPalette) return void deleteBlock(src.id);
      if (src.kind === 'new' && def?.hat) {
        const wr = work.getBoundingClientRect();
        if (x >= wr.left && x <= wr.right && y >= wr.top && y <= wr.bottom) addHat(def.hat, null);
        return;
      }
      if (!t) return;
      if (src.kind === 'new') {
        const r = insertBlock(program(), src.type, t.parent, t.index);
        if (r.id === null) return;
        commit(r.program);
        selectedId = r.id;
      } else {
        commit(moveBlock(program(), src.id, t.parent, t.index));
        selectedId = src.id;
      }
      render();
    };

    const cancel = (ev: PointerEvent): void => {
      if (ev.pointerId !== pid) return;
      cleanup();
    };

    cancelDrag = cleanup;
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  }

  // ----- Darstellung -----
  function render(): void {
    undoBtn.disabled = !session.canUndo;
    redoBtn.disabled = !session.canRedo;
    clearBtn.classList.toggle('off', !hasContent());
    stage.showCounter(usesCounter(program()));
    renderPalette();
    renderProgram();
  }

  function renderPalette(): void {
    tabs.innerHTML = '';
    tabs.dataset.count = String(shownCategories.length);
    for (const c of shownCategories) {
      const b = button(`bk-tab${c.id === tab ? ' on' : ''}`, categoryIcon(c.id), () => {
        tab = c.id;
        renderPalette();
      }, c.name);
      b.style.setProperty('--c', CATEGORY_COLOR[c.id]);
      tabs.append(b);
    }
    items.innerHTML = '';
    for (const d of shown.filter((x) => x.category === tab)) {
      const it = button('pal-item', lab(blockIcon(d.type), d.name), () => undefined, d.name);
      it.style.setProperty('--c', CATEGORY_COLOR[d.category]);
      it.dataset.type = d.type;
      it.addEventListener('pointerdown', (e) => armDrag(it, e, { kind: 'new', type: d.type }, null, () => tapAdd(d.type, it)));
      it.addEventListener('click', (e) => {
        if (e.detail === 0) tapAdd(d.type, it); // Tastatur
      });
      items.append(it);
    }
  }

  function slot(parent: number | null, index: number, empty: boolean, nested: boolean): HTMLElement {
    const s = h('div', `slot${empty ? ' empty' : ''}${empty && nested ? ' nested' : ''}`, empty ? `<span class="slot-ico">${uiIcon('plus')}</span>` : '');
    s.dataset.parent = parent === null ? '' : String(parent);
    s.dataset.index = String(index);
    return s;
  }

  function seq(list: Block[], parent: number | null): DocumentFragment {
    const frag = document.createDocumentFragment();
    list.forEach((b, i) => {
      frag.append(slot(parent, i, false, false), blockEl(b));
    });
    frag.append(slot(parent, list.length, list.length === 0, parent !== null && parent > 0));
    return frag;
  }

  function chipHtml(d: ParamDef, v: number | string): string {
    if (d.kind === 'choice') return choiceHtml(d.key, String(v));
    return `<span class="chip-n">${paramLabel(d, v)}</span>`;
  }

  function blockEl(b: Block): HTMLElement {
    const def = blockDef(b.type)!;
    const sel = selectedId === b.id;
    const el = h('div', `blk${isContainer(b.type) ? ' container' : ''}${sel ? ' sel' : ''}`);
    el.dataset.id = String(b.id);
    el.style.setProperty('--c', CATEGORY_COLOR[def.category]);
    const head = h('div', 'blk-head');
    const grip = h('div', 'blk-grip', uiIcon('grip'));
    grip.addEventListener('pointerdown', (e) => armDrag(grip, e, { kind: 'move', id: b.id }, el, () => undefined));
    head.append(grip, h('span', 'blk-ico', blockIcon(b.type)));
    for (const d of def.params) {
      const chip = button(`chip p-${d.key}`, chipHtml(d, b.params[d.key]), (ev) => {
        ev.stopPropagation();
        void editParam(b, d);
      }, d.key);
      head.append(chip);
    }
    head.append(h('span', 'blk-fill'));
    if (sel) {
      const tools = h('div', 'blk-tools');
      tools.append(
        button('btool', ICONS.copy, (ev) => {
          ev.stopPropagation();
          const r = duplicateBlock(program(), b.id);
          if (r.id === null) return shake(tools);
          commit(r.program);
          selectedId = r.id;
          render();
          scrollToBlock(r.id);
        }, 'Kopieren'),
        button('btool del', ICONS.trash, (ev) => {
          ev.stopPropagation();
          void deleteBlock(b.id);
        }, 'Löschen'),
      );
      head.append(tools);
    }
    head.addEventListener('click', (ev) => {
      if (justDragged) return;
      if ((ev.target as HTMLElement).closest('.chip, .blk-tools')) return;
      selectedId = sel ? null : b.id;
      selectedHat = null;
      render();
    });
    el.append(head);
    if (isContainer(b.type)) {
      const body = h('div', 'blk-body');
      body.append(seq(b.children ?? [], b.id));
      el.append(body, h('div', 'blk-foot'));
    }
    return el;
  }

  function renderProgram(): void {
    const keep = work.scrollTop;
    prog.innerHTML = '';
    prog.append(h('div', 'hat', `<span class="hat-ico">${uiIcon('start')}</span>`));
    prog.append(seq(program().blocks, null));
    for (const hat of HAT_TYPES) {
      const list = program().events?.[hat];
      if (!list) continue;
      const def = BLOCK_DEFS.find((d) => d.hat === hat)!;
      const head = h('div', 'hat ev', `<span class="hat-ico">${blockIcon(def.type)}</span>`);
      head.dataset.id = String(HAT_PARENT[hat]);
      head.style.setProperty('--c', CATEGORY_COLOR.event);
      head.classList.toggle('sel', selectedHat === hat);
      head.append(button('hat-x', ICONS.cross, () => void removeHat(hat), 'Skript löschen'));
      head.addEventListener('click', (ev) => {
        if (justDragged || (ev.target as HTMLElement).closest('.hat-x')) return;
        selectedHat = selectedHat === hat ? null : hat;
        selectedId = null;
        render();
      });
      prog.append(head, seq(list, HAT_PARENT[hat]));
    }
    work.scrollTop = keep;
    paintRun(false);
  }

  // Leere Fläche antippen = nichts gewählt (neue Blöcke kommen dann ans Ende)
  work.addEventListener('click', (ev) => {
    if (justDragged) return;
    const t = ev.target as HTMLElement;
    if (t === work || t === prog || t.classList.contains('slot') || t.closest('.slot')) {
      if (selectedId !== null || selectedHat) {
        selectedId = null;
        selectedHat = null;
        render();
      }
    }
  });

  const onKey = (e: KeyboardEvent): void => {
    if (document.querySelector('.overlay')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') {
      if (cancelDrag) cancelDrag();
      else if (selectedId !== null) {
        selectedId = null;
        render();
      }
    } else if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      doRedo();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId !== null) {
      e.preventDefault();
      void deleteBlock(selectedId);
    }
  };
  document.addEventListener('keydown', onKey);

  render();
  if (task) queueMicrotask(() => void openTaskInfo(task));
  return () => {
    cancelDrag?.();
    window.clearTimeout(celebrateTimer);
    player.dispose();
    document.removeEventListener('keydown', onKey);
  };
}

// ---------- Fenster für Werte ----------

/** Zahl mit Plus/Minus. Liefert die neue Zahl oder null bei Abbruch. */
function openStepper(b: Block, d: NumParam, value: number): Promise<number | null> {
  return new Promise((resolve) => {
    const def = blockDef(b.type)!;
    const o = overlay('overlay-dim');
    let v = value;
    const done = (r: number | null) => {
      o.close();
      resolve(r);
    };
    const card = h('div', 'stepper');
    card.style.setProperty('--c', CATEGORY_COLOR[def.category]);
    const ico = h('div', 'st-ico', blockIcon(b.type));
    const val = h('div', 'st-val');
    const minus = button('st-btn', uiIcon('minus'), () => set(v - d.step), 'Weniger');
    const plus = button('st-btn', uiIcon('plus'), () => set(v + d.step), 'Mehr');
    const set = (n: number) => {
      v = Math.min(d.max, Math.max(d.min, n));
      val.textContent = `${v}${d.suffix}`;
      minus.disabled = v <= d.min;
      plus.disabled = v >= d.max;
    };
    const row = h('div', 'st-row');
    row.append(minus, val, plus);
    const confirm = h('div', 'confirm-row');
    confirm.append(button('big-btn no', ICONS.cross, () => done(null), 'Abbrechen'), button('big-btn yes', ICONS.check, () => done(v), 'Fertig'));
    card.append(ico, row, confirm);
    o.root.append(card);
    o.root.addEventListener('click', (e) => {
      if (e.target === o.root) done(v);
    });
    set(v);
  });
}

/** Auswahl aus einer Liste (Lichtbilder, Töne). Liefert den neuen Wert oder null bei Abbruch. */
function openChoice(b: Block, d: ChoiceParam, value: string): Promise<string | null> {
  return new Promise((resolve) => {
    const def = blockDef(b.type)!;
    const o = overlay('overlay-dim');
    const done = (r: string | null) => {
      o.close();
      resolve(r);
    };
    const panel = h('div', 'panel pick-panel');
    panel.style.setProperty('--c', CATEGORY_COLOR[def.category]);
    const head = h('div', 'panel-head');
    head.append(h('span', 'st-ico small', blockIcon(b.type)), button('tbtn close', ICONS.cross, () => done(null), 'Schließen'));
    const grid = h('div', `choice-grid ${d.key}`);
    for (const opt of d.options) {
      const inner = choiceHtml(d.key, opt);
      grid.append(button(`cpick${opt === value ? ' on' : ''}`, inner, () => done(opt), opt));
    }
    panel.append(head, grid);
    o.root.append(panel);
    o.root.addEventListener('click', (e) => {
      if (e.target === o.root) done(null);
    });
  });
}
