# All My Costs

Application Expo / React Native de suivi des dépenses récurrentes et ponctuelles.

## Installation

```bash
npm install
```

## Développement Android

```bash
npx expo run:android
```

## Build Google Play (AAB)

```bash
eas build --platform android --profile production
```

Les achats Pro sont gérés par RevenueCat et Google Play Billing. Les variables
`EXPO_PUBLIC_REVENUECAT_API_KEY` et `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`
doivent être définies dans l'environnement de build.
