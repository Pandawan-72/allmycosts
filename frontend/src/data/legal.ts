/**
 * Legal text content for the app (Privacy Policy + Terms).
 * Plain JavaScript — easy to update without touching components.
 * Tokens like {{APP_NAME}}, {{COMPANY}}, {{EMAIL}}, {{LAST_UPDATED}} are replaced at render time.
 */

export const LEGAL_META = {
  appName: "All My Costs",
  company: "All My Costs",
  contactEmail: "support@allmycosts.app",
  lastUpdated: "8 juin 2026 / June 8, 2026",
};

export const PRIVACY_FR = `# Politique de confidentialité

**Dernière mise à jour :** ${LEGAL_META.lastUpdated}

La présente Politique de Confidentialité décrit la façon dont **${LEGAL_META.appName}** (ci-après « l'Application ») collecte, utilise et protège vos données personnelles lorsque vous utilisez nos services.

## 1. Données collectées

Lors de votre utilisation de l'Application, nous pouvons collecter :

- **Informations de compte** : nom, adresse e-mail, mot de passe haché (bcrypt).
- **Données d'authentification Google** (si vous choisissez Google Sign-In) : nom, e-mail, photo de profil.
- **Données d'abonnement** : nom, montant, devise, cycle, catégorie et date de prochain paiement de chacun de vos abonnements personnels. Ces données sont **stockées localement sur votre appareil** et ne sont jamais transmises à nos serveurs.
- **Données de paiement** : gérées exclusivement par notre prestataire de paiement (Stripe, Apple App Store ou Google Play). Nous ne stockons aucune information de carte bancaire.
- **Données techniques** : type d'appareil, langue, fuseau horaire, version de l'application, journaux d'erreur anonymisés.

## 2. Finalités

- Permettre la création et la gestion de votre compte
- Sécuriser l'accès à vos données (authentification)
- Traiter les paiements liés à l'offre Pro
- Fournir et améliorer les fonctionnalités de l'Application
- Vous contacter en cas de support utilisateur

## 3. Base légale (RGPD)

- Exécution du contrat : création de compte, gestion des abonnements Pro.
- Consentement : connexion via Google.
- Intérêt légitime : amélioration de l'Application, prévention de la fraude.

## 4. Partage des données

Nous ne vendons ni ne louons vos données. Nous partageons uniquement avec :

- **Stripe Payments Europe Ltd.** — traitement des paiements (https://stripe.com/privacy).
- **Apple Inc.** et **Google LLC** — distribution de l'Application et achats intégrés (lorsque applicable).
- **MongoDB Atlas** — hébergement chiffré des comptes utilisateurs.
- **Open ER API** — taux de change en lecture seule.
- **Autorités légales** uniquement si requis par la loi.

## 5. Conservation

- Compte utilisateur : conservé tant que le compte est actif ; supprimé sur demande.
- Données de paiement Stripe : conservées 10 ans (obligation comptable).
- Données locales sur l'appareil : supprimées à la désinstallation de l'Application ou via le bouton « Se déconnecter ».

## 6. Vos droits (RGPD)

Vous disposez à tout moment des droits suivants :

- Accès, rectification et effacement de vos données
- Limitation et opposition au traitement
- Portabilité des données
- Retrait du consentement

Pour exercer vos droits, écrivez-nous à **${LEGAL_META.contactEmail}**. Nous vous répondrons sous 30 jours.

## 7. Sécurité

Vos mots de passe sont hachés avec bcrypt. Toutes les communications avec nos serveurs se font en HTTPS (TLS 1.2+). Les paiements sont chiffrés bout en bout par Stripe.

## 8. Mineurs

L'Application n'est pas destinée aux moins de 16 ans. Nous ne collectons pas sciemment de données concernant des mineurs.

## 9. Modifications

Nous pouvons mettre à jour cette politique à tout moment. La date de dernière mise à jour est indiquée en haut de cette page. En cas de modification substantielle, nous vous en informerons par e-mail ou dans l'Application.

## 10. Contact

**${LEGAL_META.company}**
E-mail : ${LEGAL_META.contactEmail}

Pour toute question concernant cette politique, contactez-nous à l'adresse ci-dessus.
`;

export const TERMS_FR = `# Conditions Générales d'Utilisation

**Dernière mise à jour :** ${LEGAL_META.lastUpdated}

Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation de l'application **${LEGAL_META.appName}**. En accédant à l'Application, vous acceptez sans réserve ces CGU.

## 1. Objet

L'Application permet aux utilisateurs de répertorier et de suivre leurs abonnements personnels, de visualiser leur coût total, d'exporter des rapports PDF et de bénéficier de statistiques détaillées.

## 2. Compte utilisateur

Vous devez créer un compte (e-mail/mot de passe ou Google) pour utiliser l'Application. Vous vous engagez à fournir des informations exactes et à maintenir la confidentialité de vos identifiants. Tout usage de votre compte vous est imputable.

## 3. Période d'essai gratuite

Toute nouvelle inscription bénéficie d'un **essai gratuit de 48 heures** donnant accès à l'ensemble des fonctionnalités Pro. À l'issue de cette période, l'accès Pro est suspendu sauf souscription à une formule payante.

## 4. Formules payantes (Pro)

- **Mensuelle** : 2,99 €/mois — facturée chaque mois jusqu'à résiliation.
- **Annuelle** : 23,88 €/an — facturée une fois par an jusqu'à résiliation.
- **À vie** : 69 € — paiement unique, accès permanent à toutes les fonctionnalités Pro.

Les prix peuvent varier selon votre devise locale (conversion via taux de change quotidien). La facturation effective est réalisée en EUR.

## 5. Paiement et résiliation

- **Sur le Web** : les paiements sont traités par **Stripe**. Vous pouvez résilier votre abonnement à tout moment depuis l'Application ou en nous contactant.
- **Sur iOS** : achats gérés par l'App Store, résiliation via vos Réglages Apple.
- **Sur Android** : achats gérés par Google Play Store, résiliation via votre compte Google Play.

Conformément à la législation européenne, vous disposez d'un **droit de rétractation de 14 jours** pour les abonnements numériques, **sauf** si vous avez expressément accepté de bénéficier immédiatement du service Pro (case cochée lors du paiement).

## 6. Utilisation acceptable

Vous vous engagez à ne pas :

- Tenter d'accéder à des comptes autres que le vôtre
- Faire de l'ingénierie inverse de l'Application
- Utiliser l'Application à des fins illégales ou contraires aux bonnes mœurs
- Surcharger volontairement nos serveurs

## 7. Propriété intellectuelle

L'Application, son code, son design, son logo et son contenu sont la propriété exclusive de **${LEGAL_META.company}** et protégés par les lois sur la propriété intellectuelle. Toute reproduction non autorisée est interdite.

## 8. Limitation de responsabilité

L'Application est fournie « en l'état ». Nous ne pouvons être tenus responsables :

- D'une indisponibilité temporaire du service
- De la perte de données causée par une mauvaise utilisation
- De toute décision financière prise sur la base des informations affichées dans l'Application

L'Application est un outil d'aide à la gestion personnelle ; elle ne constitue **pas** un conseil financier.

## 9. Données

L'utilisation de l'Application est soumise à notre Politique de Confidentialité, accessible dans l'Application et sur notre site.

## 10. Modifications des CGU

Nous nous réservons le droit de modifier ces CGU à tout moment. Les utilisateurs seront notifiés par e-mail ou par notification dans l'Application des modifications substantielles.

## 11. Droit applicable

Les présentes CGU sont régies par le droit français. Tout litige relève de la compétence exclusive des tribunaux du ressort de notre siège social.

## 12. Contact

**${LEGAL_META.company}**
E-mail : ${LEGAL_META.contactEmail}
`;

export const PRIVACY_EN = `# Privacy Policy

**Last updated:** ${LEGAL_META.lastUpdated}

This Privacy Policy describes how **${LEGAL_META.appName}** ("the App") collects, uses and protects your personal data when you use our services.

## 1. Data Collected

We may collect:

- **Account information**: name, email address, hashed password (bcrypt).
- **Google authentication data** (if you use Google Sign-In): name, email, profile picture.
- **Subscription data**: name, amount, currency, billing cycle, category and next payment date of each of your personal subscriptions. This data is **stored locally on your device** and never sent to our servers.
- **Payment data**: handled exclusively by our payment processor (Stripe, Apple App Store or Google Play). We do not store any credit card information.
- **Technical data**: device type, language, time zone, app version, anonymized error logs.

## 2. Purposes

- Enable account creation and management
- Secure access to your data (authentication)
- Process payments for the Pro plan
- Provide and improve App features
- Contact you in case of user support

## 3. Legal Basis (GDPR)

- Contract performance: account creation, Pro plan management.
- Consent: Google login.
- Legitimate interest: App improvement, fraud prevention.

## 4. Data Sharing

We do not sell or rent your data. We share only with:

- **Stripe Payments Europe Ltd.** — payment processing (https://stripe.com/privacy).
- **Apple Inc.** and **Google LLC** — App distribution and in-app purchases (when applicable).
- **MongoDB Atlas** — encrypted hosting of user accounts.
- **Open ER API** — read-only exchange rates.
- **Legal authorities** only if required by law.

## 5. Retention

- User account: kept while account is active; deleted upon request.
- Stripe payment data: retained 10 years (accounting obligation).
- Local data on device: deleted on app uninstall or via "Sign out" button.

## 6. Your Rights (GDPR)

You have the right to:

- Access, correct and erase your data
- Restrict and object to processing
- Data portability
- Withdraw consent

To exercise your rights, write to **${LEGAL_META.contactEmail}**. We will respond within 30 days.

## 7. Security

Passwords are hashed with bcrypt. All communications with our servers use HTTPS (TLS 1.2+). Payments are end-to-end encrypted by Stripe.

## 8. Minors

The App is not intended for users under 16 years old. We do not knowingly collect data about minors.

## 9. Changes

We may update this policy at any time. The last update date is shown at the top. For substantial changes, we will notify you by email or in the App.

## 10. Contact

**${LEGAL_META.company}**
Email: ${LEGAL_META.contactEmail}

For any question, contact us at the address above.
`;

export const TERMS_EN = `# Terms of Service

**Last updated:** ${LEGAL_META.lastUpdated}

These Terms of Service ("Terms") govern your use of **${LEGAL_META.appName}** ("the App"). By accessing the App, you accept these Terms in full.

## 1. Purpose

The App allows users to list and track their personal subscriptions, visualize their total cost, export PDF reports and access detailed statistics.

## 2. User Account

You must create an account (email/password or Google) to use the App. You agree to provide accurate information and keep your credentials confidential. Any use of your account is your responsibility.

## 3. Free Trial

Every new sign-up benefits from a **48-hour free trial** granting access to all Pro features. After this period, Pro access is suspended unless you subscribe to a paid plan.

## 4. Paid Plans (Pro)

- **Monthly**: €2.99/month — billed monthly until cancellation.
- **Yearly**: €23.88/year — billed once a year until cancellation.
- **Lifetime**: €69 — one-time payment, permanent access to all Pro features.

Prices may vary based on your local currency (daily exchange rate conversion). Actual billing is in EUR.

## 5. Payment and Cancellation

- **On the Web**: payments are processed by **Stripe**. You can cancel anytime from the App or by contacting us.
- **On iOS**: purchases handled by the App Store, cancel via Apple Settings.
- **On Android**: purchases handled by Google Play Store, cancel via your Google Play account.

Per European law, you have a **14-day right of withdrawal** for digital subscriptions, **unless** you explicitly agreed to immediate Pro service (checkbox at payment).

## 6. Acceptable Use

You agree not to:

- Try to access accounts other than yours
- Reverse-engineer the App
- Use the App for illegal or immoral purposes
- Deliberately overload our servers

## 7. Intellectual Property

The App, its code, design, logo and content are the exclusive property of **${LEGAL_META.company}** and protected by intellectual property laws. Unauthorized reproduction is prohibited.

## 8. Limitation of Liability

The App is provided "as is". We cannot be held liable for:

- Temporary service unavailability
- Data loss caused by misuse
- Any financial decision made based on information displayed in the App

The App is a personal management tool; it does **not** constitute financial advice.

## 9. Data

Use of the App is subject to our Privacy Policy, accessible in the App and on our website.

## 10. Changes to the Terms

We reserve the right to amend these Terms at any time. Users will be notified by email or in-app notification of substantial changes.

## 11. Governing Law

These Terms are governed by French law. Any dispute falls under the exclusive jurisdiction of the courts of our registered office.

## 12. Contact

**${LEGAL_META.company}**
Email: ${LEGAL_META.contactEmail}
`;
