# 🚀 BUILD ANDROID — Internal Testing via Google Play

Guide pas à pas pour générer un AAB signé d'**All My Costs** et le distribuer
à vos testeurs via le canal Internal Testing du Play Store, **gratuitement**.

---

## 📋 Pré-requis (à faire UNE SEULE FOIS)

1. Compte **Expo gratuit** : créez-en un sur https://expo.dev/signup
2. Compte **Google Play Console Developer** : déjà créé ✅
3. App **All My Costs** créée dans Play Console avec package `com.allmycosts.app` ✅
4. **Node.js 18+** installé sur votre ordinateur : https://nodejs.org
5. **Git** installé : https://git-scm.com

---

## 1️⃣ Récupérer le code source

Depuis l'interface Emergent, cliquez sur **"Save to GitHub"** pour pousser votre
projet vers un nouveau repo. Puis sur votre PC/Mac :

```bash
git clone https://github.com/<votre-user>/<votre-repo>.git
cd <votre-repo>/frontend
yarn install
```

---

## 2️⃣ Installer EAS CLI et se connecter

```bash
npm install -g eas-cli
eas login
# → entrez vos identifiants Expo
```

---

## 3️⃣ Lier le projet à votre compte Expo (UNE SEULE FOIS)

```bash
eas init
# Confirmez la création d'un nouveau projet → notez le "project ID"
```

EAS va générer un `extra.eas.projectId` dans votre `app.json` automatiquement.

---

## 4️⃣ Générer le AAB de production

```bash
eas build --platform android --profile production
```

Pendant le build, EAS vous demandera :
- **Génération d'une nouvelle clé de signing Android** → choisissez **"Generate new keystore"** (EAS la garde en sûreté pour vous)
- **Version code** → laissez EAS l'auto-incrémenter

⏱ Durée : **10-20 minutes** dans le cloud Expo (gratuit, 30 builds/mois).

Une fois terminé, EAS vous donne un **lien de téléchargement du fichier `.aab`**.

---

## 5️⃣ Uploader le AAB sur le Internal Testing

1. Allez sur https://play.google.com/console
2. Sélectionnez l'app **All My Costs**
3. Menu gauche → **Tests et versions → Tests internes**
4. Cliquez **"Créer une version"**
5. Section "Bundles d'app" → **Importer** → glissez votre fichier `.aab` téléchargé d'EAS
6. **Nom de la version** : `1.0.0 (internal test)`
7. **Notes de version** : *« Première version test. Bienvenue ! Merci de
   signaler tout bug à contact@retro-spare.fr. »*
8. Cliquez **"Examiner"** → **"Démarrer le déploiement vers les tests internes"**

---

## 6️⃣ Ajouter vos testeurs

1. Toujours dans **Tests internes** → onglet **"Testeurs"**
2. Cliquez **"Créer une liste d'adresses e-mail"**
3. Nommez-la `Testeurs Retro-Spare`
4. Ajoutez les **adresses Gmail** de vos testeurs (une par ligne)
   - Important : ce doit être les Gmail liés à leur compte Play Store
5. Sauvegardez et **cochez la liste** pour l'associer au canal Internal Testing
6. Copiez le **"Lien d'inscription pour les testeurs"** affiché en bas de page

---

## 7️⃣ Distribution aux testeurs

Envoyez ce lien d'inscription à vos testeurs (email, SMS, etc.). Sur leur
téléphone Android, ils :

1. Ouvrent le lien dans Chrome
2. Cliquent **"Devenir testeur"**
3. Cliquent **"Télécharger sur Google Play"**
4. Installent l'app comme n'importe quelle app du Play Store

✅ Les **achats RevenueCat sandbox** fonctionneront automatiquement sur ces
appareils car ils sont reconnus comme licensed testers.

---

## 🔄 Pour publier une mise à jour

Quand vous avez fait des changements dans le code :

```bash
cd frontend
eas build --platform android --profile production
```

Puis re-uploadez le nouveau AAB sur le canal Tests internes du Play Console.
Les testeurs recevront la mise à jour automatiquement.

---

## ❓ Dépannage

| Problème | Solution |
|---|---|
| `eas: command not found` | Relancez `npm install -g eas-cli` (peut nécessiter `sudo`) |
| Build échoue avec "Invalid keystore" | Supprimez `credentials.json` et laissez EAS regénérer une keystore |
| Testeurs voient "Application non disponible" | Attendez 15-30 min après l'upload, et vérifiez qu'ils sont bien dans la liste |
| RevenueCat ne reconnaît pas l'achat | Vérifiez que les produits sont en statut "Actif" dans Play Console, et que la signing key dans RevenueCat correspond à celle utilisée par EAS (option "Generate new keystore" la première fois) |

---

## 📞 Support

- Documentation EAS Build : https://docs.expo.dev/build/introduction
- Documentation Play Console : https://support.google.com/googleplay/android-developer
- Support Retro-Spare : contact@retro-spare.fr
