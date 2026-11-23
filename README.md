# MINT2Go Programmieren

Programmieren lernen für Kinder von 6 bis 10 Jahren, als Web-App für das iPad (Safari, Home-Bildschirm, Querformat).
Lehrerzentriert: Die Lehrkraft führt mit Folien und einem Live-Programm ein, die Kinder üben danach selbst mit Blöcken
an einem simulierten Roboter.

## Bereiche

- **Unterricht:** 4 Lektionen mit Folien für den Beamer, mit Notizen für die Lehrkraft und Sprungtasten in die App.
- **Einstieg:** Die Klasse sagt die Befehle, die Lehrkraft schreibt sie als Karten auf (z. B. aus einer Flasche trinken), ein Kind macht das Programm vor, Fehlersuche.
- **Blöcke:** Programmieren mit Symbol-Blöcken (Reihenfolge, Wiederholen, Wenn, Ereignisse, Zähler) an einem simulierten Roboter.
- **Aufgaben:** 15 Übungsaufgaben in 4 Stufen mit automatischer Prüfung.
- **Kinder-Profile** mit eigenem Fortschritt; **Klassenübersicht** der Lehrkraft (langer Druck auf das Logo, 1,5 s).

Alle Daten bleiben auf dem Gerät (kein Server nötig); nach dem ersten Laden läuft die App offline.

## Entwickeln

```
npm install
npm run dev      # http://localhost:5175
npm test         # Vitest
npm run build    # Ausgabe: dist/ (statische Webseite)
```

Veröffentlichen: `npm run deploy` baut die Seite und schiebt `dist/` auf den Zweig `gh-pages`; GitHub Pages liefert diesen Zweig aus.
Weitere Hinweise zum Aufbau stehen in [CLAUDE.md](CLAUDE.md), Lizenzen in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
