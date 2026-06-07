# PDF Export Template — LOCKED VERSION

> **Status:** 🔒 FROZEN — validated by the user on 2025-06-15.
> Future agents MUST NOT modify the PDF layout unless the user explicitly asks for
> a layout change. Bug fixes (typos, i18n, accessibility) on this template are OK
> as long as the visual structure below is preserved.

## Canonical structure (top to bottom)

1. **Header** — single row:
   - Square brand logo (56×56, 12px radius), `getBrandLogoBase64()` source
   - `<h1>All My Costs</h1>` (24px, 900 weight, letter-spacing −0.6px)
   - `<p>{user.name}</p>` (12px, #6B7280)
   - Bottom border `#E5E7EB`
   - **No Stats / PDF / Settings icons, no FAB, no print metadata, no date in the top-right corner.**

2. **Totals row** — two equal cards:
   - Left card (light, #F9FAFB): "TOTAL MENSUEL" label + monthly value (28px black)
   - Right card (dark, #111827): "TOTAL ANNUEL" label + yearly value (28px **#10B981 green**)

3. **"Détail des abonnements"** — table:
   - Header columns: `Abonnement` (left) · `Mensuel` (right) · `Annuel` (right) — 10px gray uppercase
   - Each row contains:
     - Subscription name (14px bold)
     - Below: `<span class="dot">` colored by category + category label (11px gray)
     - **NO app icon, NO subscription brand image**
     - Monthly amount in user's base currency, right-aligned, bold
     - Annual amount in user's base currency, right-aligned, bold
   - Rows sorted by monthly cost descending
   - Bottom hairline `#F3F4F6` between rows

4. **"Répartition par catégorie"** — stats block:
   - SVG donut chart (200×200, stroke-width 26, gray track #F3F4F6)
   - Center label: "MENSUEL" + monthly total
   - Legend on the right: one row per category (colored dot + label, amount, percentage)

5. **Footer** — single bottom row:
   - Left: `Généré le <date FR long>`
   - Right: `Devise : <base currency code>`
   - Top border `#E5E7EB`, color `#9CA3AF`, 10px

## Code locations

- HTML generation: `frontend/app/(app)/home.tsx` → `const html = \`...\`` inside `exportPdf()`
- Header banner comment marks the section as locked
- Logo source: `frontend/src/utils/brandLogoBase64.ts` (loads the brand PNG asset)

## Platform rendering

| Platform | Path | Notes |
|----------|------|-------|
| iOS / Android | `Print.printToFileAsync({ html, base64: false, useMarkupFormatter: true })` → `Sharing.shareAsync(uri, ...)` | Sharing sheet, **not** the print dialog (Android fix) |
| Web | Hidden `<iframe>` populated with the HTML, then `iframe.contentWindow.print()` | Required because `expo-print` would otherwise print the current page (the home screen) instead of our HTML |

⚠️ The web iframe branch is **mandatory** — removing it breaks the export (regressions confirmed in past iterations).

## Reference snapshot

A captured copy of a real export is stored at this path for future visual
comparison:

- `/app/memory/pdf_template_locked_sample.html` (≈1.9 MB, includes inlined base64 logo)

Open it in any browser to see the exact reference rendering.
