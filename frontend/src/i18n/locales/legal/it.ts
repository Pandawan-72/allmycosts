const LEGAL_IT = {
  lastUpdated: "Ultimo aggiornamento: 12 giugno 2026",
  editor: "All My Costs",
  contact: "dev@retro-spare.fr",
  country: "France",
  openMailto: "Contattaci via email",
  aboutSection: "INFORMAZIONI",
  privacyTitle: "Informativa sulla privacy",
  termsTitle: "Termini di servizio",
  privacy: {
    intro: "Questa informativa spiega come All My Costs raccoglie, utilizza e protegge i tuoi dati.",
    sections: [
      { title: "1. Editore", body: "All My Costs è pubblicata da All My Costs. Contatto: dev@retro-spare.fr." },
      { title: "2. Dati raccolti", body: "Nome, indirizzo email (Firebase). Google Sign-In: nome, email, foto. Nessun dato bancario memorizzato." },
      { title: "3. Dati locali", body: "Tutte le tue spese ricorrenti, spese una tantum, foto degli scontrini e entrate (predefinite e per mese) sono memorizzate esclusivamente in locale sul tuo dispositivo e non vengono mai inviate ai nostri server, ad eccezione del testo descritto nell’articolo 4." },
      { title: "4. Scansione scontrini con IA (funzione Pro)", body: "Quando scansioni uno scontrino, il testo viene estratto direttamente sul tuo dispositivo (riconoscimento testo offline). Solo questo testo, mai la foto stessa, viene inviato a un servizio IA di terze parti (Anthropic) per estrarre nome del commerciante, importo e data. La foto dello scontrino resta memorizzata solo sul tuo dispositivo." },
      { title: "5. Uso dei dati", body: "Utilizziamo i tuoi dati solo per: creare e proteggere il tuo account, gestire l'accesso Pro, rispondere alle richieste di assistenza, strutturare il testo degli scontrini scansionati (funzione Pro)." },
      { title: "6. Servizi di terze parti", body: "All My Costs usa: Google Sign-In / Firebase (autenticazione), RevenueCat (acquisti Pro), Google Play (pagamenti), open.er-api.com (tassi di cambio), Anthropic (strutturazione del testo degli scontrini scansionati, funzione Pro)." },
      { title: "7. Conservazione", body: "Account Firebase conservato finché attivo; eliminato su richiesta. Dati locali (incluse foto degli scontrini) eliminati alla disinstallazione. Il testo inviato per la scansione non viene conservato da noi oltre l’elaborazione immediata." },
      { title: "8. I tuoi diritti (GDPR)", body: "Accesso, rettifica, cancellazione, portabilità, opposizione. Contatto: dev@retro-spare.fr." },
      { title: "9. Sicurezza", body: "Autenticazione tramite Firebase. Tutte le comunicazioni crittografate HTTPS/TLS, inclusa la scansione degli scontrini." },
      { title: "10. Minori", body: "App non destinata agli utenti sotto i 16 anni." },
      { title: "11. Contatto", body: "dev@retro-spare.fr" }
    ]
  },
  terms: {
    intro: "Questi Termini regolano l'uso dell'applicazione All My Costs.",
    sections: [
      { title: "1. Accettazione", body: "Utilizzando l'App, accetti questi Termini." },
      { title: "2. Versione gratuita e Pro", body: "Gratuito: fino a 6 spese totali (ricorrenti e una tantum combinate), totale mensile/annuale, valuta base. Pro (3,99 € acquisto unico): spese illimitate, statistiche, esportazione PDF, categorie illimitate, scansione scontrini con IA, archiviazione e condivisione foto scontrini." },
      { title: "3. Prova gratuita di 15 giorni", body: "Al primo accesso, ogni utente ottiene una prova gratuita di 15 giorni con accesso Pro completo." },
      { title: "4. Acquisto unico Pro", body: "L'accesso Pro è disponibile tramite un acquisto unico di 3,99 € su Google Play. Nessun abbonamento né addebiti ricorrenti." },
      { title: "5. Ripristino acquisti", body: "Usa il pulsante Ripristina acquisti nelle impostazioni con lo stesso account Google Play." },
      { title: "6. Rimborsi", body: "I rimborsi sono gestiti da Google Play secondo la loro politica." },
      { title: "7. Uso accettabile", body: "Non aggirare le limitazioni, fare reverse engineering o usare l'App illegalmente." },
      { title: "8. Proprietà intellettuale", body: "L'App e il suo contenuto sono proprietà esclusiva di All My Costs." },
      { title: "9. Limitazione di responsabilità", body: "App fornita così com'è. Nessuna responsabilità per perdita di dati locali o decisioni finanziarie." },
      { title: "10. Contatto", body: "dev@retro-spare.fr" }
    ]
  }
};
export default LEGAL_IT;
