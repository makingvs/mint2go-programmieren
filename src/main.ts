import '@fontsource-variable/jost';
import './style.css';
import './blocks.css';
import './tasks.css';
import './lesson.css';
import './profile.css';
import { blockScreen } from './blockEditor';
import { homeScreen } from './home';
import { liveScreen } from './liveEditor';
import { presenterScreen } from './presenter';
import { clearBugs, updateStep } from './program';
import { lessonById } from './lesson';
import { lessonListScreen, slideScreen } from './lessonScreen';
import { currentProfile, loadDone, setCurrentProfile } from './profileStore';
import { profileScreen } from './profileScreen';
import type { Profile } from './profiles';
import { BlockSession, LiveSession, TaskSession } from './session';
import { teacherScreen } from './teacherScreen';
import { taskById } from './tasks';
import { tasksScreen } from './taskScreen';

const app = document.getElementById('app')!;
const session = new LiveSession();
let cleanup: (() => void) | null = null;

// Kein Zoomen der Seite, kein Herunterziehen, kein Textmarkieren.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick']) {
  document.addEventListener(ev, (e) => e.preventDefault());
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (!(e.target as HTMLElement).closest('.live-list, .pres-list, .icon-grid, .ex-grid, .panel, .bk-work, .bk-items, .choice-grid, .task-list, .tc-body, .lesson-list, .slide, .slide-notes, .p-grid, .an-grid, .cls-wrap')) e.preventDefault();
  },
  { passive: false },
);

function leave(): void {
  cleanup?.();
  cleanup = null;
}

/** Wohin "Start" führt: normal die Startseite, aus einer Folie heraus zurück zur Folie. */
let returnTo: (() => void) | null = null;

function goHome(): void {
  const r = returnTo;
  returnTo = null;
  if (r) r();
  else showHome();
}

function showHome(): void {
  if (updatePending) return location.reload();
  returnTo = null;
  leave();
  homeScreen(app, {
    profile: currentProfile(),
    onLessons: showLessons,
    onLive: () => showLive(),
    onBlocks: showBlocks,
    onTasks: showTasks,
    onProfiles: () => showProfiles(),
    onTeacher: showTeacher,
  });
}

/** Blöcke und Aufgaben gehören einem Kind: erst "Wer bist du?", wenn noch keins gewählt ist. */
function withProfile(next: (p: Profile) => void): void {
  const p = currentProfile();
  if (p) next(p);
  else showProfiles(next);
}

function showProfiles(next?: (p: Profile) => void): void {
  if (updatePending) return location.reload();
  leave();
  cleanup = profileScreen(app, {
    current: currentProfile(),
    onPick: (p) => {
      setCurrentProfile(p.id);
      if (next) next(p);
      else showHome();
    },
    onHome: goHome,
  });
}

function showTeacher(): void {
  if (updatePending) return location.reload();
  returnTo = null;
  leave();
  cleanup = teacherScreen(app, showHome);
}

function showLessons(): void {
  if (updatePending) return location.reload();
  returnTo = null;
  leave();
  cleanup = lessonListScreen(app, { onHome: showHome, onOpen: (id) => showSlides(id, 0) });
}

function showSlides(id: string, index: number): void {
  const lesson = lessonById(id);
  if (!lesson) return showLessons();
  if (updatePending) return location.reload();
  returnTo = null;
  leave();
  cleanup = slideScreen(app, {
    lesson,
    index,
    onList: showLessons,
    onAction: (a, i) => {
      returnTo = () => showSlides(id, i); // "Start" in der App bringt zurück zur Folie
      if (a.kind === 'live') showLive();
      else if (a.kind === 'blocks') showBlocks();
      else if (a.kind === 'tasks') showTasks();
      else showTask(a.id);
    },
  });
}

function showTasks(): void {
  withProfile((profile) => {
    if (updatePending) return location.reload();
    leave();
    cleanup = tasksScreen(app, { profile, done: loadDone(profile.id), onHome: goHome, onProfiles: () => showProfiles(() => showTasks()), onOpen: showTask });
  });
}

function showTask(id: string): void {
  const task = taskById(id);
  if (!task) return showTasks();
  withProfile((profile) => {
    if (updatePending) return location.reload();
    leave();
    cleanup = blockScreen(app, { session: new TaskSession(profile.id, id), profileId: profile.id, task, onHome: showTasks, onTasks: showTasks, onNextTask: showTask });
  });
}

function showBlocks(): void {
  withProfile((profile) => {
    if (updatePending) return location.reload();
    leave();
    cleanup = blockScreen(app, { session: new BlockSession(profile.id), profileId: profile.id, onHome: goHome });
  });
}

function showLive(insertAt: number | null = null, insertHint = ''): void {
  if (updatePending) return location.reload();
  leave();
  cleanup = liveScreen(app, { session, insertAt, insertHint, onHome: goHome, onPresent: showPresent });
}

function showPresent(): void {
  leave();
  // Neuer Durchgang: alte "klappt nicht"-Markierungen weg (die Lehrkraft hat den Fehler inzwischen behoben)
  session.commit(clearBugs(session.program));
  cleanup = presenterScreen(app, {
    program: session.program,
    onEdit: () => showLive(),
    onBug: (index) => {
      const step = session.program.steps[index];
      if (step) session.commit(updateStep(session.program, step.id, { bug: true }));
      showLive(index, 'Was muss vor diesem Schritt passieren?');
    },
  });
}

// Offline-Betrieb: Service Worker (nur über https oder localhost verfügbar).
// Neue App-Version: erst beim nächsten Wechsel zur Startseite/zum Editor neu laden, nie mitten im Vorführen.
let updatePending = false;
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // erster Besuch: nichts zu aktualisieren
    updatePending = true;
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

showHome();
