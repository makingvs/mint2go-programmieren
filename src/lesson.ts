// Unterrichtsfolge für die Lehrkraft: 4 Lektionen mit Folien (Beamer), Merksätzen, Notizen und Sprungstellen in die Übungsteile.
// Reine Daten ohne DOM, damit testbar.

/** Block für die Beispiel-Zeichnung auf einer Folie (nur Anzeige, wird nicht ausgeführt) */
export interface VisualBlock {
  type: string;
  params?: Record<string, number | string>;
  children?: VisualBlock[];
}

/** Wohin die Taste einer Folie springt */
export type SlideAction = { kind: 'live'; label: string } | { kind: 'blocks'; label: string } | { kind: 'tasks'; label: string } | { kind: 'task'; id: string; label: string };

export interface Slide {
  id: string;
  title: string;
  /** Kurzer Text für die Klasse (groß auf dem Beamer) */
  text: string;
  /** Merksatz, wird farbig hervorgehoben */
  keep?: string;
  /** Beispiel aus Blöcken */
  visual?: VisualBlock[];
  /** Taste, die in die App springt (danach kommt man zur Folie zurück) */
  action?: SlideAction;
  /** Hinweise für die Lehrkraft (nur auf Wunsch sichtbar) */
  notes: string;
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  /** Lernziel in einem Satz */
  goal: string;
  slides: Slide[];
}

const b = (type: string, params?: Record<string, number | string>, children?: VisualBlock[]): VisualBlock => ({ type, params, children });
const fwd = (n: number) => b('forward', { n });
const right = b('turnRight', { deg: 90 });

export const LESSONS: Lesson[] = [
  {
    id: 'l1',
    title: 'Befehle und Reihenfolge',
    minutes: 45,
    goal: 'Die Kinder verstehen: Ein Programm ist eine Liste von Befehlen, die der Reihe nach ausgeführt werden.',
    slides: [
      {
        id: 'l1-programm',
        title: 'Was ist ein Programm?',
        text: 'Ein Programm ist eine Liste von Befehlen. Der Roboter macht sie genau der Reihe nach.',
        keep: 'Befehl für Befehl, der Reihe nach.',
        visual: [fwd(3), right, fwd(2)],
        notes: 'Frage in die Klasse: Welche Geräte befolgen Befehle (Ampel, Spielzeugauto, Handy)? Dauer ca. 5 Minuten.',
      },
      {
        id: 'l1-flasche',
        title: 'Wir schreiben ein Programm',
        text: 'Wie trinkt man aus einer Flasche Wasser? Sagt mir jeden Schritt.',
        action: { kind: 'live', label: 'Programm aufschreiben' },
        notes:
          'Die Kinder rufen die Schritte, Sie schreiben jede Antwort als Karte auf (Eingabe oben, Enter). Schreiben Sie genau auf, was gesagt wird, auch wenn Schritte fehlen: Das ist später die Fehlersuche. Dauer ca. 10 Minuten.',
      },
      {
        id: 'l1-vorfuehren',
        title: 'Ein Kind ist der Roboter',
        text: 'Ein Kind macht genau das, was auf den Karten steht. Nicht mehr und nicht weniger.',
        action: { kind: 'live', label: 'Zum Programm' },
        notes:
          'Im Live-Programm auf Vorführen tippen. Das Kind liest die Karte, macht den Schritt, Sie tippen auf Gemacht. Dauer ca. 10 Minuten. Tasten: Leertaste oder Pfeil rechts = weiter.',
      },
      {
        id: 'l1-fehler',
        title: 'Fehler finden',
        text: 'Klappt etwas nicht? Dann fehlt ein Schritt, oder die Reihenfolge stimmt nicht.',
        keep: 'Einen Fehler suchen und beheben gehört zum Programmieren dazu.',
        action: { kind: 'live', label: 'Zum Programm' },
        notes:
          'Bei einem Fehler im Vorführen auf Klappt nicht tippen: Der Schritt wird rot, die Einfügemarke steht davor. Die Klasse sagt, was fehlt. Das Beispiel "Flasche – mit Fehler" (Beispiele im Editor) zeigt es sofort. Dauer ca. 5 Minuten.',
      },
      {
        id: 'l1-roboter',
        title: 'Befehle für den Roboter',
        text: 'Der Roboter versteht Blöcke. Jeder Block ist ein Befehl. Wir stecken sie untereinander zusammen.',
        visual: [fwd(3), right, fwd(2), b('showImage', { img: 'heart' })],
        action: { kind: 'blocks', label: 'Roboter ausprobieren' },
        notes: 'Im Blöcke-Editor gemeinsam ein kurzes Programm bauen und mit Start laufen lassen. Zeigen Sie auch Schritt (ein Befehl nach dem anderen) und Tempo. Dauer ca. 5 Minuten.',
      },
      {
        id: 'l1-ueben',
        title: 'Jetzt seid ihr dran',
        text: 'Bringt den Roboter zur Flagge und sammelt die Sterne ein.',
        action: { kind: 'tasks', label: 'Aufgaben öffnen' },
        notes: 'Aufgaben 1 bis 4 (Stufe Reihenfolge). Die Kinder arbeiten allein oder zu zweit am iPad. Der Roboter prüft selbst, ob die Aufgabe gelöst ist. Dauer ca. 10 Minuten.',
      },
    ],
  },
  {
    id: 'l2',
    title: 'Wiederholen',
    minutes: 45,
    goal: 'Die Kinder erkennen Muster und sparen Blöcke mit Wiederholen.',
    slides: [
      {
        id: 'l2-viel',
        title: 'Immer dasselbe?',
        text: 'Ein Quadrat fahren: vier Seiten, vier Ecken. Das sind 8 Blöcke, und alle sehen fast gleich aus.',
        visual: [fwd(3), right, fwd(3), right, fwd(3), right, fwd(3), right],
        notes: 'Lassen Sie die Kinder das Muster selbst entdecken: Was wiederholt sich? Dauer ca. 5 Minuten.',
      },
      {
        id: 'l2-wiederholen',
        title: 'Wiederholen!',
        text: 'Statt alles aufzuschreiben, sagen wir: Mach das 4 Mal.',
        keep: 'Wiederholen spart Blöcke.',
        visual: [b('repeat', { n: 4 }, [fwd(3), right])],
        action: { kind: 'blocks', label: 'Ausprobieren' },
        notes: 'Im Blöcke-Editor das Quadrat mit Wiederholen bauen. Ändern Sie die Zahl 4 auf 3 oder 5 und fragen Sie, was dann passiert. Dauer ca. 10 Minuten.',
      },
      {
        id: 'l2-treppe',
        title: 'Gemeinsam: die Treppe',
        text: 'Welches Muster steckt in der Treppe? Was wiederholt sich?',
        action: { kind: 'task', id: 't05', label: 'Aufgabe Treppe' },
        notes: 'Muster: vor, rechts, vor, links. Vier Mal. Lassen Sie die Kinder das Muster erst mit den Händen oder Schritten im Raum nachmachen. Dauer ca. 10 Minuten.',
      },
      {
        id: 'l2-piep',
        title: 'Wiederholen mit Ton',
        text: 'Im Wiederholen-Block kann alles stehen: fahren, leuchten, piepen.',
        visual: [b('repeat', { n: 5 }, [fwd(2), b('beep', { note: 'c' })])],
        action: { kind: 'task', id: 't07', label: 'Aufgabe Piep-Straße' },
        notes: 'Ton muss am iPad eingeschaltet sein (Taste Ton, Stummschalter prüfen). Dauer ca. 5 Minuten.',
      },
      {
        id: 'l2-ueben',
        title: 'Jetzt seid ihr dran',
        text: 'Löst die Aufgaben mit Wiederholen. Achtet auf die Zahl der Blöcke.',
        action: { kind: 'tasks', label: 'Aufgaben öffnen' },
        notes: 'Aufgaben 5 bis 8 (Stufe Wiederholen). Bei Aufgaben mit Block-Grenze zeigt das Symbol mit der Zahl, wie viele Blöcke erlaubt sind. Dauer ca. 15 Minuten.',
      },
    ],
  },
  {
    id: 'l3',
    title: 'Wenn und Bis',
    minutes: 45,
    goal: 'Die Kinder lassen den Roboter selbst entscheiden: Wiederhole bis, Wenn-dann.',
    slides: [
      {
        id: 'l3-wand',
        title: 'Wie weit ist die Wand?',
        text: 'Wir wissen es nicht. Der Roboter soll selbst schauen: Fahre, bis eine Wand kommt.',
        keep: 'Wiederhole, bis etwas passiert.',
        visual: [b('repeatUntil', { cond: 'wall' }, [fwd(1)])],
        notes: 'Vergleich aus dem Alltag: Wir laufen, bis wir an der Tür sind, ohne die Schritte zu zählen. Dauer ca. 5 Minuten.',
      },
      {
        id: 'l3-bis',
        title: 'Gemeinsam: bis zur Wand',
        text: 'Der Roboter fährt nach rechts, bis er an der Wand ist.',
        action: { kind: 'task', id: 't09', label: 'Aufgabe Bis zur Wand' },
        notes: 'Am Block erscheint bei jeder Prüfung ein grüner Haken (Bedingung stimmt) oder ein graues Kreuz. Zeigen Sie das im Einzelschritt. Dauer ca. 10 Minuten.',
      },
      {
        id: 'l3-wenn',
        title: 'Wenn – dann',
        text: 'Wenn eine Wand vor mir ist, dann drehe ich mich. Sonst fahre ich weiter.',
        keep: 'Wenn etwas stimmt, dann passiert etwas.',
        visual: [b('if', { cond: 'wall' }, [right])],
        notes: 'Alltag: Wenn es regnet, dann nehme ich einen Schirm. Lassen Sie die Kinder eigene Wenn-dann-Sätze finden. Dauer ca. 5 Minuten.',
      },
      {
        id: 'l3-umweg',
        title: 'Umweg um ein Hindernis',
        text: 'Wenn ein Hindernis im Weg ist, geht der Roboter außen herum. Sonst fährt er geradeaus.',
        visual: [b('repeat', { n: 11 }, [b('if', { cond: 'wall' }, [b('turnLeft', { deg: 90 }), fwd(1), right]), fwd(1)])],
        action: { kind: 'task', id: 't11', label: 'Aufgabe Umweg mit Wenn' },
        notes: 'Anspruchsvoll, eher für schnelle Kinder oder als gemeinsame Lösung an der Tafel. Lassen Sie die Klasse im Einzelschritt verfolgen, wann das Wenn zutrifft. Dauer ca. 10 Minuten.',
      },
      {
        id: 'l3-ueben',
        title: 'Jetzt seid ihr dran',
        text: 'Der Roboter entscheidet selbst. Löst die Aufgaben der dritten Stufe.',
        action: { kind: 'tasks', label: 'Aufgaben öffnen' },
        notes: 'Aufgaben 9 bis 11 (Stufe Wenn und Bis). Dauer ca. 15 Minuten.',
      },
    ],
  },
  {
    id: 'l4',
    title: 'Ereignisse und Zähler',
    minutes: 45,
    goal: 'Die Kinder lassen den Roboter auf Ereignisse reagieren und sich eine Zahl merken.',
    slides: [
      {
        id: 'l4-ereignis',
        title: 'Ereignisse',
        text: 'Manchmal passiert etwas, und der Roboter reagiert: Wenn man ihn antippt. Wenn er an die Wand stößt.',
        keep: 'Ein Ereignis löst ein Programm aus.',
        visual: [b('whenTap', {}, [b('showImage', { img: 'heart' })])],
        notes: 'Alltag: Wenn es klingelt, öffne ich die Tür. Das Programm wartet, bis das Ereignis kommt (blauer Rahmen, Wartet). Dauer ca. 5 Minuten.',
      },
      {
        id: 'l4-tippen',
        title: 'Gemeinsam: Tippen!',
        text: 'Wenn man den Roboter antippt, soll das Herz leuchten.',
        action: { kind: 'task', id: 't14', label: 'Aufgabe Tippen!' },
        notes: 'Den Ereignis-Kopf antippen, dann kommen neue Blöcke aus der Palette in sein Skript. Nach dem Start den Roboter antippen. Dauer ca. 10 Minuten.',
      },
      {
        id: 'l4-zaehler',
        title: 'Der Zähler',
        text: 'Der Roboter kann sich eine Zahl merken. Bei jedem Schritt zählt er eins dazu.',
        keep: 'Der Zähler merkt sich eine Zahl.',
        visual: [b('setCount', { n: 0 }), b('repeat', { n: 5 }, [b('addCount', { n: 1 }), b('beep', { note: 'c' })])],
        notes: 'Die Zahl steht oben rechts auf der Bühne, sobald das Programm den Zähler benutzt. Dauer ca. 5 Minuten.',
      },
      {
        id: 'l4-zaehle',
        title: 'Gemeinsam: zähle bis 5',
        text: 'Der Roboter zählt bis 5 und piept bei jeder Zahl.',
        action: { kind: 'task', id: 't12', label: 'Aufgabe Zähle bis 5' },
        notes: 'Dauer ca. 10 Minuten.',
      },
      {
        id: 'l4-ueben',
        title: 'Jetzt seid ihr dran',
        text: 'Ereignisse und Zähler: Löst die letzten Aufgaben.',
        action: { kind: 'tasks', label: 'Aufgaben öffnen' },
        notes: 'Aufgaben 12 bis 15 (Stufe Zähler und Ereignisse). Dauer ca. 10 Minuten.',
      },
      {
        id: 'l4-ende',
        title: 'Das haben wir gelernt',
        text: 'Reihenfolge, Wiederholen, Wenn, Ereignisse und der Zähler: Damit kann man viele Programme bauen.',
        keep: 'Ihr seid Programmierer!',
        visual: [fwd(2), b('repeat', { n: 3 }, [right]), b('if', { cond: 'wall' }, [b('beep', { note: 'g' })]), b('whenTap', {}, [b('showImage', { img: 'smile' })]), b('addCount', { n: 1 })],
        notes: 'Abschlussrunde: Was war am schwersten? Was hat Spaß gemacht? Die Kinder können ein eigenes Programm im Blöcke-Editor bauen.',
      },
    ],
  },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/** Folienstand begrenzen (0 bis Anzahl - 1). */
export function clampSlide(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, Math.round(index)));
}
