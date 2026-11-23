# Drittanbieter-Software, Lizenzen und Herkunft

Stand: 23.11.2026. Geprüft mit dem Lockfile (`package-lock.json`, 95 Pakete), den Lizenzdateien in `node_modules` und der gebauten Seite (`dist/`).

## 1. Was mit der App ausgeliefert wird

| Bestandteil | Version | Lizenz | Hinweis |
|---|---|---|---|
| **Jost** (Schrift), © 2020 The Jost Project Authors, <https://github.com/indestructible-type/Jost>, über das npm-Paket `@fontsource-variable/jost` ([Fontsource](https://fontsource.org)) | 5.3.0 | **SIL Open Font License 1.1** | Unverändert, nicht umbenannt, nicht einzeln verkauft. Kein „Reserved Font Name“ erklärt. Lizenztext liegt der Seite bei: [`public/licenses/font-jost.txt`](public/licenses/font-jost.txt) (ausgeliefert als `licenses/font-jost.txt`). |
| **Vite-Hilfscode** (kleiner Lader für Module, wird beim Bauen in die JavaScript-Datei übernommen) | 5.4.21 | **MIT**, © 2019-present VoidZero Inc. and Vite contributors | Reiner Build-Hilfscode, kein eigenes Programmteil. |

Sonst ist **keine Bibliothek** im Programm: Roboter-Simulator, Block-Logik, Aufgaben-Prüfung, Folien, Profile und Oberfläche sind selbst geschrieben. Es gibt **keine externen Anfragen** (keine Schriften-, Skript- oder Bild-Server, keine Statistik, keine Cookies); alles kommt von der eigenen Adresse.

## 2. Werkzeuge nur beim Entwickeln (werden nicht ausgeliefert)

| Werkzeug | Version | Lizenz |
|---|---|---|
| Vite (Bauwerkzeug), © 2019-present VoidZero Inc. and Vite contributors | 5.4.21 | MIT |
| Vitest (Tests), © 2021-Present Vitest Team | 2.1.9 | MIT |
| TypeScript (Typprüfung), © Microsoft Corporation | 5.9.3 | Apache-2.0 |
| @types/node (Typen), © Microsoft Corporation | 22.20.5 | MIT |
| weitere 90 Pakete, die diese Werkzeuge mitbringen | – | MIT (86), ISC (2: `picocolors`, `siginfo`), BSD-3-Clause (1: `source-map-js`), Apache-2.0 (1: `expect-type`) |

Alle Lizenzen sind permissiv (keine Copyleft-Lizenz wie GPL/AGPL/LGPL). Die Lizenz von Vite, Vitest und TypeScript betrifft nur die Werkzeuge, nicht die damit gebaute App.

## 3. Was vom Gerät kommt (nicht mitgeliefert)

- **Tier-Symbole der Kinder-Profile** sind Unicode-Emoji und werden mit der Emoji-Schrift des Geräts (iPad: Apple Color Emoji) angezeigt. Es werden keine Emoji-Bilddateien ausgeliefert.
- **Töne** erzeugt die Web-Audio-Funktion des Browsers; es gibt keine Audiodateien.

## 4. Eigene Inhalte und Herkunft

- **Programmcode, Aufgaben, Folientexte, Notizen:** neu geschrieben für dieses Projekt. Gemeinsame Hilfsfunktionen (`src/shared/`: Oberflächen-Helfer, Symbole, Zierelemente, Namen, Rückgängig-Verlauf) stammen aus der Laser-Zeichen-App desselben Autors und sind dort selbst geschrieben.
- **MINT2Go-Logo und Gestaltung** (`public/mint2go-logo.png`, App-Symbole, Farben, Zahnrad-Zierelemente): gehören MINT2Go. Sie sind **nicht** durch eine freie Lizenz abgedeckt, auch wenn der Code unter einer freien Lizenz stehen sollte.
- **QR-Code** (`docs/qr-programmieren.*`): mit dem selbst geschriebenen Generator `scripts/make-qr.mjs` erzeugt (keine Fremdbibliothek). „QR Code“ ist eine eingetragene Marke der DENSO WAVE INCORPORATED.
- **Teaser-Bild** (`docs/teaser.png`): eigene Zeichnung aus App-Elementen, Jost-Schrift und Logo.

## 5. Erstellung mit KI

Der Programmcode, die Aufgaben, die Folien- und Notiztexte und die Dokumentation wurden **mit Unterstützung von Claude Code (Modell Claude Sonnet 5.5, Anthropic)** unter Anleitung und Prüfung von Andreas Schiestl erstellt. Die Fachentscheidungen (Inhalt, Zielgruppe, Aufbau, Freigabe jeder Phase) traf der Autor. Hinweis: Ob und in welchem Umfang an KI-Ausgaben Urheberrechte entstehen, ist je nach Land unterschiedlich geklärt. Eine Lizenz für den Code legt der Autor fest (bisher: keine Lizenzdatei, also alle Rechte vorbehalten).

## 6. Dienste und Werkzeuge außerhalb des Codes

- **GitHub / GitHub Pages:** Quellcode und Auslieferung der Seite; es gelten die GitHub-Nutzungsbedingungen. GitHub kann beim Aufruf technische Zugriffsdaten wie die IP-Adresse protokollieren.
- **Microsoft Edge (Headless)** nur zum Erzeugen des Teaser-Bildes, **Node.js** zum Bauen. Beides ist nicht Teil der Software.

## 7. Datenschutz-Hinweis für den Schuleinsatz

Namen und Fortschritt der Kinder werden nur im Speicher des jeweiligen Geräts (localStorage) abgelegt und nicht übertragen. Empfehlung: nur Vornamen oder Spitznamen verwenden und die Hinweise der Schule zur Verarbeitung von Schülerdaten beachten.
