// Fertige Beispiel-Programme zum Vorführen und Anpassen (Alltags-Abläufe, die Kinder gut kennen).
import { fromList, type Program } from './program';

export interface Example {
  id: string;
  title: string;
  icon: string;
  /** Hinweis für die Lehrkraft (wird in der Auswahl nicht gezeigt, nur im Test/Code) */
  note: string;
  build: () => Program;
}

export const EXAMPLES: Example[] = [
  {
    id: 'flasche',
    title: 'Aus der Flasche trinken',
    icon: 'bottle',
    note: 'Der Einstieg: vollständiges Programm. Zum Vergleich mit dem, was die Klasse selbst gesagt hat.',
    build: () =>
      fromList('Aus der Flasche trinken', [
        ['Flasche vom Tisch nehmen', 'hand'],
        ['Deckel aufdrehen', 'cap'],
        ['Deckel auf den Tisch legen', 'down'],
        ['Flasche zum Mund heben', 'up'],
        ['Flasche kippen', 'turn'],
        ['Einen Schluck trinken', 'mouth'],
        ['Flasche wieder gerade halten', 'bottle'],
        ['Flasche auf den Tisch stellen', 'down'],
        ['Deckel nehmen und zudrehen', 'cap'],
      ]),
  },
  {
    id: 'flasche-fehler',
    title: 'Flasche – mit Fehler',
    icon: 'bug',
    note: 'Fehlersuche: Es fehlt "Deckel aufdrehen". Beim Vorführen bei "Flasche kippen" auf "klappt nicht" tippen.',
    build: () =>
      fromList('Flasche – mit Fehler', [
        ['Flasche vom Tisch nehmen', 'hand'],
        ['Flasche zum Mund heben', 'up'],
        ['Flasche kippen', 'turn'],
        ['Einen Schluck trinken', 'mouth'],
        ['Flasche auf den Tisch stellen', 'down'],
      ]),
  },
  {
    id: 'zaehne',
    title: 'Zähne putzen',
    icon: 'brush',
    note: 'Alltags-Ablauf mit klarer Reihenfolge (erst Zahnpasta, dann putzen).',
    build: () =>
      fromList('Zähne putzen', [
        ['Zahnbürste nehmen', 'hand'],
        ['Zahnpasta auf die Bürste geben', 'drop'],
        ['Bürste in den Mund nehmen', 'mouth'],
        ['Alle Zähne putzen', 'brush'],
        ['Zahnpasta ausspucken', 'down'],
        ['Mund ausspülen', 'cup'],
        ['Bürste abspülen und weglegen', 'drop'],
      ]),
  },
  {
    id: 'haende',
    title: 'Hände waschen',
    icon: 'drop',
    note: 'Gut zum Üben der Reihenfolge; "20 Sekunden reiben" zeigt später die Schleife.',
    build: () =>
      fromList('Hände waschen', [
        ['Wasserhahn aufdrehen', 'drop'],
        ['Hände nass machen', 'hand'],
        ['Seife nehmen', 'hand'],
        ['Hände einseifen und reiben', 'wait'],
        ['Seife abspülen', 'drop'],
        ['Wasserhahn zudrehen', 'turn'],
        ['Hände abtrocknen', 'star'],
      ]),
  },
  {
    id: 'brot',
    title: 'Pausenbrot essen',
    icon: 'eat',
    note: 'Längeres Programm; abbeißen/kauen/schlucken wiederholt sich (Hinweis auf Wiederholen).',
    build: () =>
      fromList('Pausenbrot essen', [
        ['Rucksack öffnen', 'door'],
        ['Brotdose herausholen', 'hand'],
        ['Brotdose aufmachen', 'cap'],
        ['Brot nehmen', 'hand'],
        ['Abbeißen', 'eat'],
        ['Kauen', 'mouth'],
        ['Schlucken', 'mouth'],
        ['Brotdose zumachen', 'cap'],
        ['Brotdose in den Rucksack stecken', 'down'],
      ]),
  },
  {
    id: 'tanz',
    title: 'Roboter-Tanz',
    icon: 'star',
    note: 'Hier wiederholt sich "Arme hoch, Arme runter": Vorbereitung für den Block "Wiederholen".',
    build: () =>
      fromList('Roboter-Tanz', [
        ['Arme hoch', 'up'],
        ['Arme runter', 'down'],
        ['Arme hoch', 'up'],
        ['Arme runter', 'down'],
        ['Arme hoch', 'up'],
        ['Arme runter', 'down'],
        ['Einmal drehen', 'turn'],
        ['Verbeugen', 'star'],
      ]),
  },
];

export function getExample(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
