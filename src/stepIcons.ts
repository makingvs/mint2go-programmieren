// Symbole für die Schritte des Live-Programms (selbst gezeichnet, Linienstil wie die anderen MINT2Go-Apps).

const svg = (inner: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export interface StepIcon {
  id: string;
  name: string;
  svg: string;
}

export const STEP_ICONS: StepIcon[] = [
  { id: 'hand', name: 'Nehmen', svg: svg('<path d="M8 13V5.500a1.500 1.500 0 0 1 3 0V11"/><path d="M11 10V4a1.500 1.500 0 0 1 3 0v6"/><path d="M14 10V5.500a1.500 1.500 0 0 1 3 0V13"/><path d="M8 13l-1.700-2.300a1.500 1.500 0 0 0-2.400 1.800L7 18c1.500 2.500 3 3 5.500 3 3.500 0 5.500-2.500 5.500-6v-2"/>') },
  { id: 'bottle', name: 'Flasche', svg: svg('<path d="M10 2.500h4V6l1.500 2.500V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V8.500L10 6z"/><path d="M8.500 13h7"/>') },
  { id: 'cap', name: 'Deckel', svg: svg('<ellipse cx="12" cy="9" rx="8" ry="3.500"/><path d="M4 9v5c0 1.900 3.600 3.500 8 3.500s8-1.600 8-3.500V9"/><path d="M12 12.500v5"/>') },
  { id: 'cup', name: 'Becher', svg: svg('<path d="M5.500 4h13l-1.600 15.500a1.500 1.500 0 0 1-1.500 1.500H8.600a1.500 1.500 0 0 1-1.500-1.500z"/><path d="M6.200 10h11.600"/>') },
  { id: 'mouth', name: 'Mund', svg: svg('<path d="M2.500 12c3-4.500 6-4.500 9.500-2.500 3.500-2 6.500-2 9.500 2.500-3 5-6 6-9.500 6S5.500 17 2.500 12z"/><path d="M2.500 12h19"/>') },
  { id: 'up', name: 'Hoch', svg: svg('<path d="M12 20V5M6 11l6-6 6 6"/>') },
  { id: 'down', name: 'Ablegen', svg: svg('<path d="M12 3v12M6 10l6 6 6-6"/><path d="M5 21h14"/>') },
  { id: 'turn', name: 'Drehen', svg: svg('<path d="M20 12a8 8 0 1 1-2.500-5.800"/><path d="M20 3.500V8.500h-5"/>') },
  { id: 'walk', name: 'Gehen', svg: svg('<circle cx="13" cy="4.500" r="1.800"/><path d="M12 8.500 9.500 12l3 2.500-1 6.500M12 8.500l3 3.500h3M9.500 12 7 14.500"/>') },
  { id: 'sit', name: 'Hinsetzen', svg: svg('<circle cx="9" cy="5" r="1.800"/><path d="M9 8.500V14h7M16 14v6.500M9 14v6.500M4 20.500h16"/>') },
  { id: 'door', name: 'Tür', svg: svg('<path d="M6 21V3.500h11V21M3.500 21h17"/><path d="M13.500 12.500v.5"/>') },
  { id: 'drop', name: 'Wasser', svg: svg('<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>') },
  { id: 'brush', name: 'Bürste', svg: svg('<path d="M3.500 20.500 13 11"/><path d="M13 11l2.500-2.500"/><path d="M14.500 5.500l4 4M16.500 3.500l4 4M12.500 7.500l4 4"/>') },
  { id: 'eat', name: 'Essen', svg: svg('<path d="M5 10.500a3.500 3.500 0 0 1 3-6.500h8a3.500 3.500 0 0 1 3 6.500V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>') },
  { id: 'eye', name: 'Schauen', svg: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>') },
  { id: 'wait', name: 'Warten', svg: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>') },
  { id: 'star', name: 'Fertig', svg: svg('<path d="M12 3l2.600 5.600 6.100.7-4.500 4.200 1.200 6L12 16.600 6.600 19.500l1.200-6L3.300 9.300l6.100-.7z"/>') },
  { id: 'bug', name: 'Fehler', svg: svg('<rect x="8" y="8" width="8" height="11" rx="4"/><path d="M12 8V5.500M9 6l1.500 2M15 6l-1.500 2M8 12H4.500M16 12h3.500M8.500 16.500 5.500 18.500M15.500 16.500l3 2"/>') },
];

const BY_ID = new Map(STEP_ICONS.map((i) => [i.id, i]));

export function stepIcon(id: string | null): string {
  return id ? (BY_ID.get(id)?.svg ?? '') : '';
}

export function isStepIcon(id: string): boolean {
  return BY_ID.has(id);
}
