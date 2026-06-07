# All My Costs — PRD (v2)

## Vision
Mobile app (iOS + Android, Expo) to track every subscription, see total monthly/annual cost, export PDF, multi-language, multi-currency, with a Pro plan for unlimited usage.

## Auth
- Email/password (JWT + bcrypt) and Google Sign-In (Emergent OAuth). Token stored via storage util.
- Every new user gets an automatic 48h free Pro trial.

## Storage
- Subscriptions: **local-only** (per user, via @/src/utils/storage). Never leaves the device.
- User account + Pro status: MongoDB on the backend (subscriptions remain device-local).

## Pricing (Pro)
- Monthly: **2.99 €/month**
- Yearly: **1.99 €/month** equivalent (billed **23.88 €/year** once) — "Le plus populaire" + "Économisez 33 %" badges
- Lifetime: **69 € one-time**
- All prices billed in EUR via Stripe Checkout; display auto-converted to user's local currency via daily FX (open.er-api.com).
- **MIGRATION IN PROGRESS** — Replace Stripe with RevenueCat (iOS IAP + Google Play Billing) to be policy-compliant. Stripe code will be fully removed once RevenueCat keys are provided.

## Legal
- Privacy Policy + Terms of Service available in all 8 languages, accessible via Settings → About.
- Editor: **Retro-Spare** (France) · Contact: **contact@retro-spare.fr**

## Free tier limitations
- Max 3 subscriptions
- PDF export locked
- Once trial expires (48h) → paywall enforced

## Languages
- 🇫🇷 fr (default) · 🇬🇧 en · 🇪🇸 es · 🇩🇪 de · 🇮🇹 it · 🇵🇹 pt · 🇳🇱 nl · 🇷🇺 ru
- Auto-detected on first launch from device locale, switchable in Settings.

## Features
- Subscriptions: name, price, currency, billing cycle, category, **optional next-payment date**
- 14 predefined categories + unlimited custom categories (icon + color)
- Multi-currency (~40 currencies); base currency configurable per user
- Dashboard: monthly/annual total toggle, multi-currency aware (FX conversion to base)
- PDF export (Pro) with monthly + yearly totals and full subscription list
- Payment reminders via local notifications (native only) using `expo-notifications`
- Logo: stylized coin with "?" — user-provided PNG used as app/adaptive/favicon/splash icon

## Conversion boosters implemented
- 48h free trial auto-started on signup
- "Le plus populaire" badge on yearly
- "Économisez 33%" badge on yearly
- Trial-remaining banner on home (clickable → paywall)
- Soft paywall: 3 free subs, then upgrade required
- PDF export gated → paywall

## Backend endpoints (all prefixed `/api`)
- Auth: register, login, google, me, logout
- Pricing: GET /pricing
- Stripe: POST /stripe/checkout, POST /stripe/confirm-stub (dev only), POST /stripe/webhook

## Stack
Frontend: Expo SDK 54, expo-router, i18next/react-i18next, expo-localization, expo-print, expo-sharing, expo-notifications, expo-web-browser, expo-linking, lucide-react-native, react-native-svg.
Backend: FastAPI, motor (MongoDB), bcrypt, PyJWT, httpx, stripe.

## Routes
- `/` → redirect by auth
- `/(auth)/sign-in`, `/(auth)/sign-up`
- `/(app)/home`, `/(app)/subscription`, `/(app)/settings`, `/(app)/paywall`

## Known limitations / Next
- Stripe key is `sk_test_emergent` placeholder; replace with a real `sk_test_...` to enable end-to-end checkout.
- Apple App Store requires native IAP for digital goods on iOS — current Stripe path works on web/Android. Switch to RevenueCat / In-App Purchases before iOS submission.
- Webhooks need `STRIPE_WEBHOOK_SECRET` configured for production.
