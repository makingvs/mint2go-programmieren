// Speichern der Kinder-Profile und ihres Fortschritts auf dem Gerät. Alles über KV, damit es ohne Browser testbar ist.
import {
  CURRENT_KEY,
  PROFILES_KEY,
  createProfile,
  doneKey,
  parseProfiles,
  profilePrefix,
  removeProfile,
  resolveCurrent,
  taskKey,
  type CreateError,
  type Profile,
} from './profiles';
import { localKV, readJson, type KV } from './store';
import { TASKS, parseDone } from './tasks';

export function loadProfiles(kv: KV = localKV): Profile[] {
  return readJson(kv, PROFILES_KEY, parseProfiles) ?? [];
}

function saveProfiles(list: Profile[], kv: KV): void {
  kv.set(PROFILES_KEY, JSON.stringify(list));
}

/** Das Kind, das auf diesem Gerät gerade arbeitet (null = noch keins gewählt). */
export function currentProfile(kv: KV = localKV): Profile | null {
  return resolveCurrent(loadProfiles(kv), kv.get(CURRENT_KEY));
}

export function setCurrentProfile(id: string | null, kv: KV = localKV): void {
  if (id === null) kv.remove(CURRENT_KEY);
  else kv.set(CURRENT_KEY, id);
}

/** Neues Kind anlegen und gleich zum aktuellen machen. */
export function addProfile(name: string, icon: string, kv: KV = localKV): Profile | CreateError {
  const r = createProfile(loadProfiles(kv), name, icon);
  if (typeof r === 'string') return r;
  saveProfiles(r.list, kv);
  setCurrentProfile(r.profile.id, kv);
  return r.profile;
}

/** Kind samt allen seinen Arbeiten löschen (Tier-Symbol wird wieder frei). */
export function deleteProfile(id: string, kv: KV = localKV): void {
  saveProfiles(removeProfile(loadProfiles(kv), id), kv);
  const prefix = profilePrefix(id);
  for (const k of kv.keys()) if (k.startsWith(prefix)) kv.remove(k);
  if (kv.get(CURRENT_KEY) === id) kv.remove(CURRENT_KEY);
}

export function loadDone(profileId: string, kv: KV = localKV): string[] {
  return readJson(kv, doneKey(profileId), (raw) => parseDone(raw)) ?? [];
}

export function markDone(profileId: string, taskId: string, kv: KV = localKV): void {
  const done = loadDone(profileId, kv);
  if (!done.includes(taskId)) kv.set(doneKey(profileId), JSON.stringify([...done, taskId]));
}

/** Fortschritt eines Kindes zurücksetzen: gelöste Aufgaben und die Programme der Aufgaben (das freie Programm bleibt). */
export function resetProgress(profileId: string, kv: KV = localKV): void {
  kv.remove(doneKey(profileId));
  for (const t of TASKS) kv.remove(taskKey(profileId, t.id));
}

/** Klassenübersicht für die Lehrkraft: je Kind die gelösten Aufgaben. */
export function classOverview(kv: KV = localKV): { profile: Profile; done: string[] }[] {
  return loadProfiles(kv).map((profile) => ({ profile, done: loadDone(profile.id, kv) }));
}
