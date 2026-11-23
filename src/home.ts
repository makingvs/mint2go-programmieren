// Startseite der Programmier-App.
import { cdLineMarkup, gearsMarkup } from './shared/decor';
import { button, h, onLongPress } from './shared/dom';
import { blockIcon, uiIcon } from './blockIcons';
import { LIST_ICON } from './liveEditor';
import type { Profile } from './profiles';

export interface HomeOptions {
  /** Kind, das gerade arbeitet (null = noch keins gewählt) */
  profile: Profile | null;
  onLessons: () => void;
  onLive: () => void;
  onBlocks: () => void;
  onTasks: () => void;
  /** Kind wechseln */
  onProfiles: () => void;
  /** Lehrkraft-Bereich (langer Druck auf das Logo) */
  onTeacher: () => void;
}

export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function homeScreen(root: HTMLElement, o: HomeOptions): void {
  root.innerHTML = '';
  const screen = h('div', 'screen home-screen');
  screen.append(h('div', 'decor tl', gearsMarkup()), h('div', 'decor br', gearsMarkup()));
  const logo = h('div', 'logo', '<img class="logo-img" src="mint2go-logo.png" alt="MINT2Go – MINT erleben" draggable="false">');
  onLongPress(logo, 1500, o.onTeacher);
  screen.append(logo);
  screen.append(h('h1', 'home-title', 'Programmieren lernen'));
  screen.append(
    button(
      'who',
      o.profile ? `<span class="who-ico">${o.profile.icon}</span><span class="who-n">${escapeText(o.profile.name)}</span>` : `<span class="who-ico">${uiIcon('plus')}</span><span class="who-n">Wer bist du?</span>`,
      o.onProfiles,
      o.profile ? 'Kind wechseln' : 'Wer bist du?',
    ),
  );
  const grid = h('div', 'home-grid');
  grid.append(
    button(
      'home-card lesson-card-home',
      `<span class="hc-ico">${blockIcon('goal')}</span><span class="hc-t">Unterricht</span><span class="hc-s">Folien für die Lehrkraft: 4 Lektionen mit Beispielen</span>`,
      o.onLessons,
      'Unterricht: Folien für die Lehrkraft',
    ),
    button(
      'home-card live-card',
      `<span class="hc-ico">${LIST_ICON}</span><span class="hc-t">Einstieg</span><span class="hc-s">Die Klasse sagt die Befehle, die Lehrkraft schreibt das Programm auf</span>`,
      o.onLive,
      'Einstieg: Programm aufschreiben',
    ),
    button(
      'home-card blocks-card',
      `<span class="hc-ico">${uiIcon('stack')}</span><span class="hc-t">Blöcke</span><span class="hc-s">Programme aus Blöcken zusammenstecken</span>`,
      o.onBlocks,
      'Blöcke: Programme zusammenstecken',
    ),
    button(
      'home-card tasks-card',
      `<span class="hc-ico">${uiIcon('tasks')}</span><span class="hc-t">Aufgaben</span><span class="hc-s">Den Roboter zum Ziel bringen, Sterne sammeln, Rätsel lösen</span>`,
      o.onTasks,
      'Aufgaben für den Roboter',
    ),
  );
  screen.append(grid, h('div', 'cd-wrap', cdLineMarkup()));
  root.append(screen);
}
