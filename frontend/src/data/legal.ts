/**
 * Legal text content for the app (Privacy Policy + Terms).
 * ✅ Mis à jour : nouveau business model freemium + achat unique 5,99€
 */

export const LEGAL_META = {
  appName: "All My Costs",
  company: "All My Costs",
  contactEmail: "dev@retro-spare.fr",
  lastUpdated: "12 juin 2026 / June 12, 2026",
};

export const PRIVACY_FR = `# Politique de confidentialité

**Dernière mise à jour :** ${LEGAL_META.lastUpdated}

La présente Politique de Confidentialité décrit la façon dont **${LEGAL_META.appName}** (ci-après « l'Application ») collecte, utilise et protège vos données personnelles lorsque vous utilisez nos services.

## 1. Données collectées

Lors de votre utilisation de l'Application, nous pouvons collecter :

- **Informations de compte** : nom, adresse e-mail ().
- **Données d'authentification Google** (si vous choisissez Google Sign-In) : nom, e-mail, photo de profil.
- **Données d'abonnement** : nom, montant, devise, cycle, catégorie et date de prochain paiement de chacune de vos dépenses récurrentes. Ces données sont **stockées exclusivement en local sur votre appareil** et ne sont jamais transmises à nos serveurs.
- **Données de revenus** : votre revenu mensuel saisi dans l'Application. Ces données sont également **stockées localement** et ne quittent jamais votre appareil.
- **Données de paiement** : gérées exclusivement par Google Play Store. Nous ne stockons aucune information de carte bancaire.
- **Données techniques** : type d'appareil, langue, fuseau horaire, version de l'application, journaux d'erreur anonymisés.

## 2. Finalités

- Permettre la création et la gestion de votre compte
- Traiter les paiements liés à l'offre Pro (achat unique)
- Fournir et améliorer les fonctionnalités de l'Application
- Vous contacter en cas de support utilisateur

## 3. Base légale (RGPD)

- Exécution du contrat : création de compte, gestion de l'accès Pro.
- Consentement : connexion via Google.
- Intérêt légitime : amélioration de l'Application, prévention de la fraude.

## 4. Partage des données

Nous ne vendons ni ne louons vos données. Nous partageons uniquement avec :

- **Google LLC (Play Store)** — distribution de l'Application et achats intégrés.
- **RevenueCat Inc.** — gestion des achats intégrés (https://www.revenuecat.com/privacy).
- **Open ER API** — taux de change en lecture seule.
- **Autorités légales** uniquement si requis par la loi.

## 5. Conservation

- Données locales sur l'appareil : supprimées à la désinstallation de l'Application ou via le bouton « Se déconnecter ».

## 6. Vos droits (RGPD)

Vous disposez à tout moment des droits suivants :

- Accès, rectification et effacement de vos données
- Limitation et opposition au traitement
- Portabilité des données
- Retrait du consentement

Pour exercer vos droits, écrivez-nous à **${LEGAL_META.contactEmail}**. Nous vous répondrons sous 30 jours.

## 7. Sécurité

Toutes les communications sont chiffrées en HTTPS/TLS. Les paiements sont sécurisés par Google Play.

## 8. Mineurs

L'Application n'est pas destinée aux moins de 13 ans. Nous ne collectons pas sciemment de données concernant des mineurs.

## 9. Modifications

Nous pouvons mettre à jour cette politique à tout moment. La date de dernière mise à jour est indiquée en haut de cette page.

## 10. Contact

**${LEGAL_META.company}**
E-mail : ${LEGAL_META.contactEmail}
`;

export const TERMS_FR = `# Conditions Générales d'Utilisation

**Dernière mise à jour :** ${LEGAL_META.lastUpdated}

Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation de l'application **${LEGAL_META.appName}**. En accédant à l'Application, vous acceptez sans réserve ces CGU.

## 1. Objet

L'Application permet aux utilisateurs de répertorier et de suivre leurs dépenses récurrentes personnelles, de visualiser leur coût total, d'exporter des rapports PDF et de bénéficier de statistiques détaillées.

## 2. Version gratuite

La version gratuite de l'Application est accessible sans paiement et comprend :

- Suivi de **5 dépenses récurrentes** maximum
- Affichage du total mensuel et annuel
- Gestion de la devise de base
- Conversion de devises en temps réel

Les fonctionnalités suivantes sont **réservées à la version Pro** :
- Dépenses récurrentes en nombre illimité
- Statistiques par catégorie
- Export PDF
- Catégories personnalisées illimitées

## 3. Essai gratuit de 72 heures

À la première connexion, chaque nouvel utilisateur bénéficie d'un **essai gratuit de 72 heures** donnant accès à toutes les fonctionnalités Pro. Passé ce délai, l'accès aux fonctionnalités Pro est suspendu sauf achat de la version Pro.

## 4. Version Pro — Achat unique

L'accès à toutes les fonctionnalités Pro est disponible via un **achat unique de 5,99 €**, donnant un accès permanent et illimité, sans abonnement ni frais récurrents.

Le paiement est géré par **Google Play Store**. Une fois l'achat effectué, il est définitif et lié à votre compte Google Play.

## 5. Remboursements

Les remboursements sont gérés directement par Google Play selon leur politique. Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation de 14 jours ne s'applique pas aux contenus numériques dont l'exécution a commencé après accord exprès du consommateur.

## 6. Restauration des achats

Si vous réinstallez l'Application ou changez d'appareil, vous pouvez restaurer votre achat Pro via le bouton « Restaurer mes achats » dans les paramètres, en utilisant le même compte Google Play.

## 7. Utilisation acceptable

Vous vous engagez à ne pas :

- Tenter d'accéder à des comptes autres que le vôtre
- Faire de l'ingénierie inverse de l'Application
- Utiliser l'Application à des fins illégales
- Contourner les restrictions de la version gratuite par des moyens techniques

## 8. Propriété intellectuelle

L'Application, son code, son design, son logo et son contenu sont la propriété exclusive de **${LEGAL_META.company}** et protégés par les lois sur la propriété intellectuelle.

## 9. Limitation de responsabilité

L'Application est fournie « en l'état ». Nous ne pouvons être tenus responsables :

- De la perte de données locales (les données étant stockées sur votre appareil, leur sauvegarde vous incombe)
- De toute décision financière prise sur la base des informations affichées
- De l'exactitude des taux de change affichés

L'Application est un outil d'aide à la gestion personnelle ; elle ne constitue **pas** un conseil financier.

## 10. Données

L'utilisation de l'Application est soumise à notre Politique de Confidentialité, accessible dans l'Application.

## 11. Modifications des CGU

Nous nous réservons le droit de modifier ces CGU à tout moment. Les utilisateurs seront notifiés dans l'Application des modifications substantielles.

## 12. Droit applicable

Les présentes CGU sont régies par le droit français. Tout litige relève de la compétence exclusive des tribunaux français.

## 13. Contact

**${LEGAL_META.company}**
E-mail : ${LEGAL_META.contactEmail}
`;

export const PRIVACY_EN = `# Privacy Policy

**Last updated:** ${LEGAL_META.lastUpdated}

This Privacy Policy describes how **${LEGAL_META.appName}** ("the App") collects, uses and protects your personal data.

## 1. Data Collected

- **Account information**: name, email address ().
- **Google authentication data** (if you use Google Sign-In): name, email, profile picture.
- **Recurring expense data**: stored **locally on your device only**, never sent to our servers.
- **Income data**: your monthly income entered in the App, stored **locally only**.
- **Payment data**: handled exclusively by Google Play Store.
- **Technical data**: device type, language, time zone, app version, anonymized error logs.

## 2. Purposes

- Account creation and management
- Process Pro plan purchases
- Provide and improve App features

## 3. Legal Basis (GDPR)

- Contract performance: account creation, Pro access management.
- Consent: Google login.
- Legitimate interest: App improvement, fraud prevention.

## 4. Data Sharing

We do not sell or rent your data. We share only with:

- **Google LLC (Play Store)** — App distribution and in-app purchases.
- **RevenueCat Inc.** — in-app purchase management.
- **Open ER API** — read-only exchange rates.
- **Legal authorities** only if required by law.

## 5. Retention

- Local device data: deleted on uninstall or via "Sign out".

## 6. Your Rights (GDPR)

Access, correct, erase, restrict, or port your data. Write to **${LEGAL_META.contactEmail}**.

## 7. Security

All communications encrypted via HTTPS/TLS.

## 8. Minors

The App is not intended for users under 16.

## 9. Contact

**${LEGAL_META.company}** — ${LEGAL_META.contactEmail}
`;

export const TERMS_EN = `# Terms of Service

**Last updated:** ${LEGAL_META.lastUpdated}

These Terms govern your use of **${LEGAL_META.appName}**.

## 1. Purpose

The App allows users to track recurring personal expenses, visualize costs, export PDF reports and access statistics.

## 2. Free Version

The free version includes:

- Up to **5 recurring expenses**
- Monthly and yearly total display
- Base currency management
- Real-time currency conversion

The following features require a **Pro upgrade**:
- Unlimited recurring expenses
- Category statistics
- PDF export
- Unlimited custom categories

## 3. Free 72-Hour Trial

Every new user gets a **free 72-hour trial** with full Pro access upon first sign-in.

## 4. Pro Version — One-Time Purchase

Full Pro access is available as a **one-time purchase of €5.99**, granting permanent unlimited access with no subscription or recurring fees.

Payment is processed by **Google Play Store**.

## 5. Refunds

Refunds are handled by Google Play per their policy.

## 6. Restoring Purchases

Reinstall the App or switch devices? Use "Restore my purchases" in settings with the same Google Play account.

## 7. Acceptable Use

You agree not to reverse-engineer the App, access other accounts, or circumvent free-tier limitations.

## 8. Intellectual Property

The App and all its content are the exclusive property of **${LEGAL_META.company}**.

## 9. Limitation of Liability

The App is provided "as is". We are not liable for local data loss or financial decisions based on App data.

## 10. Governing Law

These Terms are governed by French law.

## 11. Contact

**${LEGAL_META.company}** — ${LEGAL_META.contactEmail}
`;
