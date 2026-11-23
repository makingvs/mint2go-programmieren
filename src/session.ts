// Aktueller Stand einer Arbeit mit Rückgängig/Wiederholen und Entwurf auf dem Gerät (localStorage).
import { History } from './shared/history';
import { parseBlockProgram, serializeBlocks, emptyBlockProgram, type BlockProgram } from './blocks';
import { emptyProgram, parseProgram, serialize, type Program } from './program';
import { blocksKey, taskKey } from './profiles';
import { localKV, readJson, type KV } from './store';

const LIVE_KEY = 'code.live';

export class Session<T> {
  value: T;
  private history: History<T>;

  constructor(initial: T, private readonly persist: (v: T) => void) {
    this.value = initial;
    this.history = new History(initial);
  }

  /** Neuen Stand übernehmen. false = es hat sich nichts geändert. */
  commit(v: T): boolean {
    if (!this.history.commit(v)) return false;
    this.value = v;
    this.persist(v);
    return true;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }
  get canRedo(): boolean {
    return this.history.canRedo;
  }

  undo(): boolean {
    const v = this.history.undo();
    if (v === null) return false;
    this.value = v;
    this.persist(v);
    return true;
  }

  redo(): boolean {
    const v = this.history.redo();
    if (v === null) return false;
    this.value = v;
    this.persist(v);
    return true;
  }
}

/** Live-Programm der Lehrkraft (Einstieg): gehört keinem Kind, gilt für das Gerät */
export function loadDraft(kv: KV = localKV): Program | null {
  return readJson(kv, LIVE_KEY, parseProgram);
}

export class LiveSession extends Session<Program> {
  constructor(initial: Program | null = loadDraft(), kv: KV = localKV) {
    super(initial ?? emptyProgram(), (p) => kv.set(LIVE_KEY, serialize(p)));
  }
  get program(): Program {
    return this.value;
  }
}

/** Eigenes Programm je Aufgabe und Kind (damit sich die Aufgaben nicht gegenseitig überschreiben) */
export class TaskSession extends Session<BlockProgram> {
  constructor(
    readonly profileId: string,
    readonly taskId: string,
    kv: KV = localKV,
  ) {
    super(readJson(kv, taskKey(profileId, taskId), parseBlockProgram) ?? emptyBlockProgram(), (p) => kv.set(taskKey(profileId, taskId), serializeBlocks(p)));
  }
  get program(): BlockProgram {
    return this.value;
  }
}

/** Freies Block-Programm eines Kindes (Karte "Blöcke") */
export class BlockSession extends Session<BlockProgram> {
  constructor(
    readonly profileId: string,
    initial: BlockProgram | null = null,
    kv: KV = localKV,
  ) {
    super(initial ?? readJson(kv, blocksKey(profileId), parseBlockProgram) ?? emptyBlockProgram(), (p) => kv.set(blocksKey(profileId), serializeBlocks(p)));
  }
  get program(): BlockProgram {
    return this.value;
  }
}
