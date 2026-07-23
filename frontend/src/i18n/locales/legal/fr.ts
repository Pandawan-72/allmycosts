const LEGAL_FR = {
  lastUpdated: "Dernière mise à jour : 15 juillet 2026",
  editor: "All My Costs",
  contact: "dev@retro-spare.fr",
  country: "France",
  openMailto: "Nous contacter par e-mail",
  aboutSection: "À PROPOS",
  privacyTitle: "Politique de confidentialité",
  termsTitle: "Conditions Générales d'Utilisation",
  privacy: {
    intro: "Cette politique explique comment All My Costs collecte, utilise et protège vos données.",
    sections: [
      { title: "1. Éditeur", body: "L'application All My Costs est éditée par All My Costs. Contact : dev@retro-spare.fr." },
      { title: "2. Données collectées", body: "Gratuit : jusqu'à 10 dépenses au total (récurrentes et ponctuelles confondues), total mensuel/annuel, devise de base. Pro (achat unique, prix affiché sur Google Play) : dépenses illimitées, statistiques, export PDF, catégories illimitées, scan de tickets par IA, stockage et partage des photos de tickets." },
      { title: "3. Données locales", body: "Toutes vos dépenses récurrentes, dépenses ponctuelles, photos de tickets et revenus sont stockés exclusivement en local sur votre appareil. Ils ne sont jamais envoyés à nos serveurs, à l'exception du texte décrit à l'article 4 ci-dessous." },
      { title: "4. Scan de tickets par intelligence artificielle (fonctionnalité Pro)", body: "Lorsque vous scannez un ticket de caisse, le texte est extrait directement sur votre appareil (reconnaissance optique de caractères locale, hors ligne). Seul ce texte — jamais la photo elle-même — est envoyé à un service d'intelligence artificielle tiers (Anthropic) pour en extraire le nom du commerce, le montant et la date. La photo du ticket reste stockée uniquement sur votre appareil." },
      { title: "5. Utilisation des données", body: "Nous utilisons vos données uniquement pour : gérer votre accès Pro, répondre à vos demandes de support, et structurer le texte des tickets scannés (fonctionnalité Pro)." },
      { title: "6. Services tiers", body: "All My Costs utilise : RevenueCat (achats Pro), Google Play (paiements), open.er-api.com (taux de change), Anthropic (structuration du texte des tickets scannés, fonctionnalité Pro)." },
      { title: "7. Conservation", body: "Données locales (y compris photos de tickets) supprimées à la désinstallation. Le texte envoyé pour le scan de tickets n'est pas conservé au-delà du traitement immédiat." },
      { title: "8. Vos droits (RGPD)", body: "Accès, rectification, effacement, portabilité, opposition. Contactez-nous à dev@retro-spare.fr." },
      { title: "9. Sécurité", body: "Toutes les communications sont chiffrées HTTPS/TLS, y compris pour le scan de tickets. Les paiements sont sécurisés par Google Play." },
      { title: "10. Mineurs", body: "Application non destinée aux moins de 13 ans." },
      { title: "11. Contact", body: "dev@retro-spare.fr" }
    ]
  },
  terms: {
    intro: "Les présentes CGU régissent l'utilisation de l'application All My Costs.",
    sections: [
      { title: "1. Acceptation", body: "En utilisant l'Application, vous acceptez les présentes CGU." },
      { title: "2. Version gratuite et Pro", body: "Gratuit : jusqu'à 10 dépenses au total (récurrentes et ponctuelles confondues), total mensuel/annuel, devise de base. Pro (achat unique, prix affiché sur Google Play) : dépenses illimitées, statistiques, export PDF, catégories illimitées, scan de tickets par IA, stockage et partage des photos de tickets." },
      { title: "3. Essai gratuit 15 jours", body: "À la première utilisation, chaque utilisateur bénéficie d'un essai gratuit de 15 jours avec accès complet Pro." },
      { title: "4. Achat unique Pro", body: "L'accès Pro est disponible via un achat unique dont le prix est affiché sur Google Play. Aucun abonnement, aucun frais récurrent." },
      { title: "5. Restauration", body: "Utilisez le bouton Restaurer mes achats dans les paramètres avec le même compte Google Play." },
      { title: "6. Remboursements", body: "Les remboursements sont gérés par Google Play selon leur politique." },
      { title: "7. Utilisation acceptable", body: "Données locales (y compris photos de tickets) supprimées à la désinstallation. Le texte envoyé pour le scan de tickets n'est pas conservé au-delà du traitement immédiat." },
      { title: "8. Propriété intellectuelle", body: "L'Application et son contenu sont la propriété exclusive de All My Costs." },
      { title: "9. Limitation de responsabilité", body: "Toutes les communications sont chiffrées HTTPS/TLS, y compris pour le scan de tickets. Les paiements sont sécurisés par Google Play." },
      { title: "10. Contact", body: "dev@retro-spare.fr" }
    ]
  }
};
export default LEGAL_FR;
