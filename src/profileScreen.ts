// Wer bist du? Auswahl des Kindes und Anlegen eines neuen Kindes.
import { ANIMALS, ICONS } from './shared/icons';
import { button, h, lab, overlay } from './shared/dom';
import { escapeText } from './home';
import { MAX_NAME, type CreateError, type Profile } from './profiles';
import { addProfile, loadProfiles } from './profileStore';

export interface ProfileScreenOptions {
  current: Profile | null;
  onPick: (p: Profile) => void;
  onHome: () => void;
}

export function profileScreen(root: HTMLElement, o: ProfileScreenOptions): () => void {
  root.innerHTML = '';
  const screen = h('div', 'screen profiles');
  const top = h('div', 'live-top');
  top.append(button('tbtn', lab(ICONS.back, 'Zurück'), o.onHome, 'Zurück'), h('h1', 'live-title', 'Wer bist du?'));
  const grid = h('div', 'p-grid');
  screen.append(top, grid);
  root.append(screen);

  const list = loadProfiles();
  for (const p of list) {
    grid.append(button(`p-card${o.current?.id === p.id ? ' on' : ''}`, `<span class="p-ico">${p.icon}</span><span class="p-n">${escapeText(p.name)}</span>`, () => o.onPick(p), p.name));
  }
  grid.append(
    button('p-card p-add', `<span class="p-ico plus">${ICONS.plus}</span>`, () => newProfileDialog(list, o.onPick), 'Neu'),
  );
  return () => undefined;
}

const shake = (el: HTMLElement): void => {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
};

/** Neues Kind: Name tippen (Tastatur des Geräts, Feld oben) und ein Tier wählen. Vergebene Tiere sind gesperrt. */
function newProfileDialog(existing: Profile[], onPick: (p: Profile) => void): void {
  const used = new Set(existing.map((p) => p.icon));
  const o = overlay('overlay-dim overlay-top');
  const panel = h('div', 'panel np-panel');
  const head = h('div', 'panel-head');
  const name = h('input', 'name-input');
  name.type = 'text';
  name.maxLength = MAX_NAME;
  name.placeholder = '…';
  name.autocomplete = 'off';
  name.setAttribute('aria-label', 'Name');
  let chosen = ANIMALS.find((a) => !used.has(a.icon)) ?? null;
  const ok = button('tbtn np-ok', lab(ICONS.check, 'Fertig'), () => {
    if (!chosen) return shake(ok);
    const r: Profile | CreateError = addProfile(name.value, chosen.icon);
    if (typeof r === 'string') return shake(r === 'name' ? name : ok);
    o.close();
    onPick(r);
  }, 'Fertig');
  ok.disabled = !chosen;
  head.append(button('tbtn close', ICONS.cross, () => o.close(), 'Schließen'), name, ok);
  const grid = h('div', 'an-grid');
  for (const a of ANIMALS) {
    const taken = used.has(a.icon);
    const b = button(`an-item${a === chosen ? ' on' : ''}`, a.icon, () => {
      chosen = a;
      ok.disabled = false;
      for (const x of grid.querySelectorAll('.an-item')) x.classList.remove('on');
      b.classList.add('on');
    }, a.name);
    b.disabled = taken;
    grid.append(b);
  }
  panel.append(head, grid);
  o.root.append(panel);
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ok.click();
  });
  name.focus(); // direkt im Tipp, sonst öffnet das iPad die Tastatur nicht
}
