import { describe, expect, it } from 'vitest';
import { ANIMALS } from '../src/shared/icons';
import { addEvent, insertBlock, emptyBlockProgram, type BlockProgram } from '../src/blocks';
import { addProfile, classOverview, currentProfile, deleteProfile, loadDone, loadProfiles, markDone, resetProgress, setCurrentProfile } from '../src/profileStore';
import { MAX_NAME, MAX_PROFILES, blocksKey, createProfile, parseProfiles, removeProfile, resolveCurrent, taskKey, type Profile } from '../src/profiles';
import { BlockSession, TaskSession } from '../src/session';
import { memoryKV } from '../src/store';

const fox = ANIMALS[0].icon;
const cat = ANIMALS[1].icon;
const dog = ANIMALS[2].icon;

function oneBlock(): BlockProgram {
  const r = insertBlock(emptyBlockProgram(), 'forward', null, 0, { n: 3 });
  return r.program;
}

describe('Profile: Regeln', () => {
  it('neues Kind: Name wird gekürzt, ohne Namen gilt der Tiername', () => {
    const a = createProfile([], '  Anna  ', fox);
    expect(a).not.toBeTypeOf('string');
    if (typeof a === 'string') return;
    expect(a.profile).toEqual({ id: 'Anna', name: 'Anna', icon: fox });
    const b = createProfile(a.list, '', cat);
    if (typeof b === 'string') throw new Error('sollte gehen');
    expect(b.profile.name).toBe('Katze');
    const long = createProfile([], 'x'.repeat(50), dog);
    if (typeof long === 'string') throw new Error('sollte gehen');
    expect(long.profile.name).toHaveLength(MAX_NAME);
  });

  it('Name und Tier-Symbol sind eindeutig, Groß-/Kleinschreibung zählt beim Namen nicht', () => {
    const a = createProfile([], 'Anna', fox);
    if (typeof a === 'string') throw new Error();
    expect(createProfile(a.list, 'anna', cat)).toBe('name');
    expect(createProfile(a.list, 'Ben', fox)).toBe('icon');
    expect(createProfile(a.list, 'Ben', '🚀')).toBe('icon'); // kein Tier
  });

  it('höchstens MAX_PROFILES Kinder', () => {
    const list: Profile[] = Array.from({ length: MAX_PROFILES }, (_, i) => ({ id: `k${i}`, name: `k${i}`, icon: ANIMALS[i % ANIMALS.length].icon }));
    expect(createProfile(list, 'Neu', ANIMALS[0].icon)).toBe('full');
  });

  it('parseProfiles wirft Kaputtes und Doppeltes weg', () => {
    const ok = { id: 'Anna', name: 'Anna', icon: fox };
    expect(parseProfiles([ok, ok, { ...ok, id: 'B', name: 'B' }, { id: 'C', name: 'C', icon: cat }, { id: '', name: 'x', icon: dog }, null, 5, { id: 1 }])).toEqual([ok, { id: 'C', name: 'C', icon: cat }]);
    expect(parseProfiles('nope')).toEqual([]);
    expect(parseProfiles([{ id: 'A', name: '   ', icon: fox }])).toEqual([]);
  });

  it('removeProfile und resolveCurrent', () => {
    const list: Profile[] = [{ id: 'A', name: 'A', icon: fox }, { id: 'B', name: 'B', icon: cat }];
    expect(removeProfile(list, 'A').map((p) => p.id)).toEqual(['B']);
    expect(resolveCurrent(list, 'B')?.name).toBe('B');
    expect(resolveCurrent(list, 'X')).toBeNull();
    expect(resolveCurrent(list, null)).toBeNull();
  });
});

describe('Profile: Speicher je Kind', () => {
  it('addProfile speichert, macht das Kind zum aktuellen und überlebt "Neuladen"', () => {
    const kv = memoryKV();
    expect(currentProfile(kv)).toBeNull();
    const p = addProfile('Anna', fox, kv);
    expect(typeof p).toBe('object');
    expect(loadProfiles(kv).map((x) => x.name)).toEqual(['Anna']);
    expect(currentProfile(kv)?.id).toBe('Anna');
    expect(addProfile('Anna', cat, kv)).toBe('name');
    expect(loadProfiles(kv)).toHaveLength(1);
  });

  it('gelöste Aufgaben gehören dem Kind', () => {
    const kv = memoryKV();
    addProfile('Anna', fox, kv);
    addProfile('Ben', cat, kv);
    markDone('Anna', 't01', kv);
    markDone('Anna', 't01', kv);
    markDone('Anna', 't05', kv);
    expect(loadDone('Anna', kv)).toEqual(['t01', 't05']);
    expect(loadDone('Ben', kv)).toEqual([]);
  });

  it('kaputte Daten und unbekannte Aufgaben-ids ergeben eine saubere Liste', () => {
    const kv = memoryKV();
    kv.set('code.p.Anna.done', '{kaputt');
    expect(loadDone('Anna', kv)).toEqual([]);
    kv.set('code.p.Anna.done', JSON.stringify(['t01', 'x99']));
    expect(loadDone('Anna', kv)).toEqual(['t01']);
  });

  it('Programme je Aufgabe und das freie Programm sind getrennt je Kind und bleiben erhalten', () => {
    const kv = memoryKV();
    const a = new TaskSession('Anna', 't01', kv);
    expect(a.program.blocks).toHaveLength(0);
    expect(a.commit(oneBlock())).toBe(true);
    const free = new BlockSession('Anna', null, kv);
    free.commit(oneBlock());
    // neu laden
    expect(new TaskSession('Anna', 't01', kv).program.blocks).toHaveLength(1);
    expect(new TaskSession('Anna', 't02', kv).program.blocks).toHaveLength(0);
    expect(new TaskSession('Ben', 't01', kv).program.blocks).toHaveLength(0);
    expect(new BlockSession('Anna', null, kv).program.blocks).toHaveLength(1);
    expect(new BlockSession('Ben', null, kv).program.blocks).toHaveLength(0);
  });

  it('Ereignis-Skripte werden mitgespeichert', () => {
    const kv = memoryKV();
    const s = new TaskSession('Anna', 't14', kv);
    s.commit(addEvent(emptyBlockProgram(), 'tap'));
    expect(new TaskSession('Anna', 't14', kv).program.events?.tap).toEqual([]);
  });

  it('resetProgress löscht gelöste Aufgaben und Aufgaben-Programme, nicht das freie Programm', () => {
    const kv = memoryKV();
    addProfile('Anna', fox, kv);
    markDone('Anna', 't01', kv);
    new TaskSession('Anna', 't01', kv).commit(oneBlock());
    new BlockSession('Anna', null, kv).commit(oneBlock());
    resetProgress('Anna', kv);
    expect(loadDone('Anna', kv)).toEqual([]);
    expect(kv.get(taskKey('Anna', 't01'))).toBeNull();
    expect(kv.get(blocksKey('Anna'))).not.toBeNull();
  });

  it('deleteProfile löscht alle Daten des Kindes, aber nicht die anderer', () => {
    const kv = memoryKV();
    addProfile('Anna', fox, kv);
    addProfile('Ben', cat, kv);
    for (const id of ['Anna', 'Ben']) {
      markDone(id, 't01', kv);
      new BlockSession(id, null, kv).commit(oneBlock());
    }
    kv.set('code.live', '{}');
    setCurrentProfile('Anna', kv);
    deleteProfile('Anna', kv);
    expect(loadProfiles(kv).map((p) => p.id)).toEqual(['Ben']);
    expect(kv.keys().filter((k) => k.startsWith('code.p.Anna.'))).toEqual([]);
    expect(loadDone('Ben', kv)).toEqual(['t01']);
    expect(kv.get('code.live')).toBe('{}');
    expect(currentProfile(kv)).toBeNull();
    // das Tier-Symbol ist wieder frei
    expect(typeof addProfile('Neu', fox, kv)).toBe('object');
  });

  it('Name mit Sonderzeichen kann nicht in fremde Schlüssel greifen', () => {
    const kv = memoryKV();
    const p = addProfile('A.b/c', fox, kv);
    if (typeof p === 'string') throw new Error();
    expect(p.id).toBe('Abc');
    addProfile('Ab', cat, kv); // anderer Name, aber eigener Präfix "code.p.Ab."
    markDone('Abc', 't01', kv);
    deleteProfile('Ab', kv);
    expect(loadDone('Abc', kv)).toEqual(['t01']);
  });

  it('Klassenübersicht: je Kind die gelösten Aufgaben', () => {
    const kv = memoryKV();
    addProfile('Anna', fox, kv);
    addProfile('Ben', cat, kv);
    markDone('Ben', 't02', kv);
    expect(classOverview(kv).map((r) => [r.profile.name, r.done])).toEqual([
      ['Anna', []],
      ['Ben', ['t02']],
    ]);
  });
});
