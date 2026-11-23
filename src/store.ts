// Einfacher Schlüssel-Wert-Speicher auf dem Gerät (localStorage) mit austauschbarer Gegenstelle für Tests.
// Jeder Zugriff fängt Fehler ab (privater Modus, gesperrter Speicher): dann bleibt der Stand im Speicher der Sitzung.

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

export const localKV: KV = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Speichern nicht möglich */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nichts zu tun */
    }
  },
  keys() {
    try {
      return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => k !== null);
    } catch {
      return [];
    }
  },
};

/** Speicher nur im Arbeitsspeicher (Tests) */
export function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void m.set(k, v),
    remove: (k) => void m.delete(k),
    keys: () => [...m.keys()],
  };
}

/** JSON lesen und prüfen; kaputte Daten ergeben null. */
export function readJson<T>(kv: KV, key: string, parse: (raw: unknown) => T | null): T | null {
  try {
    const raw = kv.get(key);
    return raw ? parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
