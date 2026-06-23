const LEGAL_DE = {
  lastUpdated: "Letzte Aktualisierung: 12. Juni 2026",
  editor: "All My Costs",
  contact: "dev@retro-spare.fr",
  country: "France",
  openMailto: "Per E-Mail kontaktieren",
  aboutSection: "ÜBER UNS",
  privacyTitle: "Datenschutzerklärung",
  termsTitle: "Nutzungsbedingungen",
  privacy: {
    intro: "Diese Richtlinie erklärt, wie All My Costs Ihre Daten erhebt, verwendet und schützt.",
    sections: [
      { title: "1. Herausgeber", body: "All My Costs wird von All My Costs herausgegeben. Kontakt: dev@retro-spare.fr." },
      { title: "2. Erhobene Daten", body: "Name, E-Mail-Adresse (Firebase). Google Sign-In: Name, E-Mail, Foto. Keine Bankdaten gespeichert." },
      { title: "3. Lokale Daten", body: "Alle wiederkehrenden Ausgaben, einmaligen Ausgaben, Belegfotos und Einkommen (Standard und pro Monat) werden ausschließlich lokal auf Ihrem Gerät gespeichert und nie an unsere Server übertragen, mit Ausnahme des in Artikel 4 beschriebenen Texts." },
      { title: "4. KI-gestützter Belegscan (Pro-Funktion)", body: "Beim Scannen eines Belegs wird der Text direkt auf Ihrem Gerät extrahiert (offline, geräteinterne Texterkennung). Nur dieser Text — niemals das Foto selbst — wird an einen Drittanbieter-KI-Dienst (Anthropic) gesendet, um Händlername, Betrag und Datum zu extrahieren. Das Belegfoto bleibt ausschließlich auf Ihrem Gerät gespeichert." },
      { title: "5. Datenverwendung", body: "Wir verwenden Ihre Daten nur für: Konto erstellen und sichern, Pro-Zugang verwalten, Supportanfragen beantworten, gescannten Belegtext strukturieren (Pro-Funktion)." },
      { title: "6. Drittanbieterdienste", body: "All My Costs nutzt: Google Sign-In / Firebase (Authentifizierung), RevenueCat (Pro-Käufe), Google Play (Zahlungen), open.er-api.com (Wechselkurse), Anthropic (Strukturierung von gescanntem Belegtext, Pro-Funktion)." },
      { title: "7. Speicherdauer", body: "Firebase-Konto wird aufbewahrt, solange es aktiv ist; auf Anfrage gelöscht. Lokale Daten (einschließlich Belegfotos) bei Deinstallation gelöscht. Für den Belegscan gesendeter Text wird von uns nicht über die unmittelbare Verarbeitung hinaus gespeichert." },
      { title: "8. Ihre Rechte (DSGVO)", body: "Auskunft, Berichtigung, Löschung, Portabilität, Widerspruch. Kontakt: dev@retro-spare.fr." },
      { title: "9. Sicherheit", body: "Authentifizierung über Firebase. Alle Kommunikationen über HTTPS/TLS verschlüsselt, einschließlich Belegscan." },
      { title: "10. Minderjährige", body: "App nicht für Nutzer unter 13 Jahren bestimmt." },
      { title: "11. Kontakt", body: "dev@retro-spare.fr" }
    ]
  },
  terms: {
    intro: "Diese Nutzungsbedingungen regeln die Nutzung der App All My Costs.",
    sections: [
      { title: "1. Zustimmung", body: "Mit der Nutzung der App stimmen Sie diesen Bedingungen zu." },
      { title: "2. Kostenlose und Pro-Version", body: "Kostenlos: bis zu 6 Ausgaben insgesamt (wiederkehrend und einmalig zusammen), monatliche/jährliche Summe, Basiswährung. Pro (3,99 € Einmalkauf): unbegrenzte Ausgaben, Statistiken, PDF-Export, unbegrenzte Kategorien, KI-gestützter Belegscan, Speicherung und Teilen von Belegfotos." },
      { title: "3. 15 Tage kostenlose Testversion", body: "Bei der ersten Anmeldung erhält jeder Nutzer eine 15-tägige kostenlose Testversion mit vollem Pro-Zugang." },
      { title: "4. Pro-Einmalkauf", body: "Pro-Zugang ist als Einmalkauf von 3,99 € über Google Play verfügbar. Kein Abonnement, keine Folgekosten." },
      { title: "5. Käufe wiederherstellen", body: "Verwenden Sie die Schaltfläche Käufe wiederherstellen in den Einstellungen mit demselben Google Play-Konto." },
      { title: "6. Rückerstattungen", body: "Rückerstattungen werden von Google Play gemäß deren Richtlinien abgewickelt." },
      { title: "7. Zulässige Nutzung", body: "Keine Umgehung von Einschränkungen, kein Reverse Engineering, keine illegale Nutzung." },
      { title: "8. Geistiges Eigentum", body: "Die App und ihr Inhalt sind ausschließliches Eigentum von All My Costs." },
      { title: "9. Haftungsbeschränkung", body: "App wird wie besehen bereitgestellt. Keine Haftung für lokale Datenverluste oder finanzielle Entscheidungen." },
      { title: "10. Kontakt", body: "dev@retro-spare.fr" }
    ]
  }
};
export default LEGAL_DE;
