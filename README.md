# sseproject2

# LanguageApp Dokumentation (WIP)

## Übersicht

LanguageApp ist eine webbasierte Anwendung, die für Sprachlernende entwickelt wurde, um Vokabeltests zu erstellen, zu verwalten und durchzuführen. Sie bietet eine Plattform für Benutzer, um ihre Sprachkenntnisse durch benutzerdefinierte Tests zu bewerten, ihren Fortschritt zu verfolgen und detaillierte Ergebnisse zu überprüfen.

## Funktionen

### Aktuelle Funktionen

- **Benutzerauthentifizierung**: Grundlegendes Registrierungs- und Anmeldesystem für Benutzer.
- **Testverwaltung**: Benutzer können ihre Vokabeltests erstellen, bearbeiten und löschen.
- **Tests durchführen**: Benutzer können einen Vokabeltest durchführen, bei dem Fragen in zufälliger Reihenfolge präsentiert werden.
- **Ergebnisanalyse**: Nach Abschluss eines Tests werden den Benutzern ihre Punktzahl, detaillierte fragebezogene Ergebnisse und Optionen zum Wiederholen des Tests oder zur Rückkehr zum Dashboard angezeigt.
- **Zufälliger Test**: Auf dem Dashboard können Benutzer einen zufälligen Test aus ihrer Sammlung starten.
- **Test wiederholen**: Möglichkeit, Tests direkt von der Ergebnisseite aus zu wiederholen.

### In Entwicklung befindliche Funktionen

- **Statistikseite**: Eine detaillierte Ansicht des Fortschritts des Benutzers im Laufe der Zeit, die verschiedene Metriken und historische Testergebnisse anzeigt.
- **Inhaltliche Bereicherung**: Verbessertes Design.
- **Fortschrittsverfolgung**: Ein Fortschrittsbereich für die zukünftige Implementierung, der darauf abzielt, Benutzerstatistiken und Erfolge anzuzeigen.
- **User Profil**: Profilseite, auf der Nutzer Ihre Profildetails abrufen und gegebenenfalls Editieren können
- **Robuste Sicherheitsmechanismen:** Input Validation, XSS-Protection, SQL-Injection Protection, erweitertes Session Management usw.
- LOGOUT!!!

## Benutzerhandbuch

1. Anwendung mit `node app.js` starten.
2. Auf Login Seite weiter zu REGISTER
3. Gewünschten Benutzernamen und Kennwort eingeben
4. Login mit Benutzerdaten

### Verwalten von Tests

- **Erstellen eines Tests**: Auf Dashboard-Seite auf "Manage Tests" oder Navbar -> "My Tests"->"Create New Test", um neuen Vokabeltest zu erstellen.
- **Bearbeiten eines Tests**: "Manage Tests"/"My Tests"->"Edit", um beliebigen Test zu ändern.
- **Löschen eines Tests**: Verwenden Sie die Schaltfläche "Löschen" neben jedem Test auf der Seite "My Tests".

### Durchführung eines Tests

- Auf Dashboard "Run Test", um einen zufälligen Test zu starten oder einen bestimmten Test von der Seite "My Tests" mit der Schaltfläche neben den Tests.
- Beantworten jeder gestellte Frage, navigieren durch Fragen mit "Previous" und "Next".
- Senden der Antworten zur Bewertung mit "Submit Test".

### Anzeigen von Ergebnissen

- Nach dem Absenden wird die Punktzahl, der Prozentsatz und eine Aufschlüsselung jeder Frage angezeigt.
- Wählen Sie, ob Sie den Test wiederholen oder zum Dashboard zurückkehren möchten.

## Technische Dokumentation

### Architektur

Die Anwendung ist mit den folgenden Technologien gebaut:

- **Frontend**: HTML, CSS, Bootstrap, JavaScript
- **Backend**: Node.js, Express.js
- **Datenbank**: SQLite

### Datenbankschema

- `users`: Speichert Benutzerkontoinformationen.
- `tests`: Enthält die von Benutzern erstellten Tests.
- `entries`: Beinhaltet die einzelnen Fragen für jeden Test.
- `test_results`: Erfasst die Ergebnisse jedes von einem Benutzer durchgeführten Tests.

### Routen

- `/register`: Registrierungsseite.
- `/login`: Anmeldeseite.
- `/dashboard`: Haupt-Dashboard des Benutzers.
- `/my-tests`: Seite zur Verwaltung von Tests.
- `/create-test`: Formular zur Erstellung eines neuen Tests.
- `/edit-test/:testId`: Seite zum Bearbeiten eines Tests.
- `/run-test/:testId`: Schnittstelle zum Durchführen eines Tests.
- `/submit-test/:testId`: Endpunkt zur Verarbeitung der Testeinreichung.

...
