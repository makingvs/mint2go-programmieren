// Kinder-Profile der Programmier-App: Liste, Regeln (Name, Tier-Symbol) und Speicher-Schlüssel je Kind. Ohne DOM, damit testbar.
// Jedes Kind hat eigenen Speicher: freies Blöcke-Programm, ein Programm je Aufgabe, gelöste Aufgaben.
import { ANIMALS } from './shared/icons';
import { safeName } from './shared/names';

export interface Profile {
  /** aus dem Namen abgeleitet (safeName), eindeutig */
  id: string;
  /** Anzeigename */
  name: string;
  /** Tier-Symbol (Emoji aus ANIMALS), je Kind eigenes */
  icon: string;
}

export const MAX_PROFILES = 40;
export const MAX_NAME = 20;

/** Präfix aller Daten eines Kindes im Speicher */
export const profilePrefix = (id: string): string => `code.p.${id}.`;
export const blocksKey = (id: string): string => `${profilePrefix(id)}blocks`;
export const taskKey = (id: string, taskId: string): string => `${profilePrefix(id)}task.${taskId}`;
export const doneKey = (id: string): string => `${profilePrefix(id)}done`;
export const PROFILES_KEY = 'code.profiles';
export const CURRENT_KEY = 'code.profile';

/** Strenge Prüfung gespeicherter Daten: kaputte oder doppelte Einträge fallen weg. */
export function parseProfiles(raw: unknown): Profile[] {
  if (!Array.isArray(raw)) return [];
  const out: Profile[] = [];
  const ids = new Set<string>();
  const icons = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.icon !== 'string') continue;
    if (!o.id || !o.name.trim() || ids.has(o.id) || icons.has(o.icon) || !ANIMALS.some((a) => a.icon === o.icon)) continue;
    ids.add(o.id);
    icons.add(o.icon);
    out.push({ id: o.id, name: o.name.trim().slice(0, MAX_NAME), icon: o.icon });
    if (out.length >= MAX_PROFILES) break;
  }
  return out;
}

export type CreateError = 'full' | 'icon' | 'name';

/**
 * Neues Kind anlegen. Das Tier-Symbol darf noch niemand haben (es wird erst mit dem Löschen des Kindes wieder frei),
 * der Name muss neu sein. Ohne Namen gilt der Name des Tiers.
 */
export function createProfile(list: Profile[], name: string, icon: string): { list: Profile[]; profile: Profile } | CreateError {
  if (list.length >= MAX_PROFILES) return 'full';
  const animal = ANIMALS.find((a) => a.icon === icon);
  if (!animal || list.some((p) => p.icon === icon)) return 'icon';
  const shown = name.trim().slice(0, MAX_NAME) || animal.name;
  const id = safeName(shown);
  if (list.some((p) => p.id.toLowerCase() === id.toLowerCase())) return 'name';
  const profile: Profile = { id, name: shown, icon };
  return { list: [...list, profile], profile };
}

export function removeProfile(list: Profile[], id: string): Profile[] {
  return list.filter((p) => p.id !== id);
}

/** Aktuelles Kind: nur gültig, wenn es noch in der Liste ist. */
export function resolveCurrent(list: Profile[], id: string | null): Profile | null {
  return (id && list.find((p) => p.id === id)) || null;
}
