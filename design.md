# SyababFresh — Design Reference

Mobile-first PWA. All UI is built for one-handed thumb use on a 390px viewport.
Stack: Next.js 16 (App Router) · Tailwind v4 · Geist Sans/Mono.

---

## Brand Colors

Defined in `src/app/globals.css` `@theme` block and mirrored in `tailwind.config.ts`.

### Fresh (Primary actions, prices, hero gradients)
| Token | Hex | Usage |
|---|---|---|
| `brand-fresh-50` | `#F0FDF4` | Card tints, badge backgrounds |
| `brand-fresh-100` | `#DCFCE7` | Subtle fills |
| `brand-fresh-200` | `#BBF7D0` | Borders on tinted cards |
| `brand-fresh-400` | `#4ADE80` | Hero gradient mid |
| `brand-fresh-500` | `#22C55E` | Primary buttons, hero bg |
| `brand-fresh-600` | `#16A34A` | Price text, active states |
| `brand-fresh-700` | `#15803D` | Hero gradient dark end |

### Red (Badges, promo, destructive)
| Token | Hex | Usage |
|---|---|---|
| `brand-red-50` | `#FEF2F2` | Badge background |
| `brand-red-500` | `#EF4444` | Discount badges |
| `brand-red-600` | `#DC2626` | Destructive buttons, some badges |

### Yellow (Loyalty, urgency)
| Token | Hex | Usage |
|---|---|---|
| `brand-yellow-400` | `#FBBF24` | Loyalty bar fill |
| `brand-yellow-500` | `#F59E0B` | Best Seller badge |
| `brand-yellow-600` | `#D97706` | Loyalty urgency text |

---

## Typography

Font: **Geist Sans** (variable), **Geist Mono** for order numbers.

| Role | Class |
|---|---|
| Page title | `text-lg font-bold` |
| Product title (detail) | `text-[22px] font-extrabold leading-snug` |
| Product title (card) | `text-[13px] font-semibold leading-snug` |
| Section heading | `text-sm font-bold` |
| Price (detail) | `text-[28px] font-black text-brand-fresh-600` |
| Price (card) | `text-[16px] font-black text-brand-fresh-600` |
| Price (order list) | `text-[15px] font-black` |
| Unit / secondary | `text-[10px] text-gray-400` |
| Body / description | `text-sm text-gray-500 leading-[1.75]` |
| Badge text | `text-[10px] font-bold` or `text-[11px] font-extrabold` |
| Order number | `font-mono text-[11px] text-gray-400/80` |

---

## Border Radius

| Scale | Class | Typical use |
|---|---|---|
| Cards | `rounded-2xl` | Product cards, profile sections, trust tiles |
| Buttons | `rounded-xl` or `rounded-2xl` | CTA buttons, qty selectors |
| Pills/badges | `rounded-full` | Status badges, tags |
| Small inputs | `rounded-xl` | Form inputs |

> Rule: prefer `rounded-2xl` for anything card-sized. `rounded-full` for badges only.

---

## Shadows

Tailwind's `shadow-*` shortcuts don't cover the nuanced levels needed, so custom `shadow-[...]` values are used throughout.

| Level | Value | Usage |
|---|---|---|
| Floating card | `shadow-[0_3px_18px_rgba(0,0,0,0.09)]` | Product cards (default) |
| Card on tap | `shadow-[0_8px_24px_rgba(0,0,0,0.14)]` | Product cards (active) |
| Section card | `shadow-[0_2px_14px_rgba(0,0,0,0.06)]` | Profile, address sections |
| Order card | `shadow-[0_2px_12px_rgba(0,0,0,0.07)]` | Order list cards |
| CTA button | `shadow-[0_4px_16px_rgba(34,197,94,0.45)]` | Green primary button |
| CTA button dimmed | `shadow-[0_2px_8px_rgba(34,197,94,0.25)]` | Green button (active/pressed) |
| Discount badge | `shadow-[0_2px_8px_rgba(239,68,68,0.4)]` | Red badge glow |
| Pesanan Saya hero | `shadow-[0_10px_32px_rgba(34,197,94,0.42)]` | Profile page dominant card |

### Left-accent shadow (borderless left stripe on rounded cards)
```
shadow-[-3px_0_0_0_rgba(34,197,94,0.55),0_2px_10px_rgba(34,197,94,0.08)]   // green (default address)
shadow-[-3px_0_0_0_rgba(245,158,11,0.55),0_2px_14px_rgba(0,0,0,0.06)]      // amber (incomplete profile)
```
Using a negative-X box-shadow creates a 3 px left "border" without breaking `border-radius` on the other corners.

---

## Micro-interactions

Global base set in `globals.css`:
```css
button:not(:disabled):active, a:active {
  transform: scale(0.97);
  transition: transform 0.08s ease;
}
```

Component-level overrides (always `transition-all duration-150`):

| Element | Default | Active |
|---|---|---|
| Product card | — | `active:scale-[0.97]` |
| Order card | — | `active:scale-[0.98]` |
| Profile section cards | — | `active:scale-[0.97]` |
| Primary CTA button | — | `active:scale-[0.97]` + shadow collapse |
| Qty ± buttons | — | `active:scale-90` |
| Dominant hero link | — | `active:scale-[0.96]` |

Pulsing animations (urgency signals):
```jsx
// breathing shimmer on loyalty bar
<div className="animate-pulse" style={{ animationDuration: '2.5s' }} />

// Zap icon bg on "Stok cepat habis"
<div className="animate-pulse" style={{ animationDuration: '3s' }} />

// "Disyorkan" pulse dot
<span className="animate-pulse" style={{ animationDuration: '2s' }} />
```

---

## Image Conventions

| Context | Scale | Background | Overlay |
|---|---|---|---|
| Product card | `scale-[1.28]` | `bg-[#f0f0ee]` | `h-14 from-black/22` |
| Product detail | `scale-[1.06]` | `bg-[#f0f0ee]` | `h-20 from-black/20` |

Gradient overlay pattern (always `pointer-events-none`):
```jsx
<div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/22 to-transparent" />
```

---

## Buttons

### Primary CTA (Add to cart, main actions)
```
bg-brand-fresh-500 text-white font-bold rounded-2xl py-4
shadow-[0_4px_16px_rgba(34,197,94,0.45)]
active:scale-[0.97] active:shadow-[0_2px_8px_rgba(34,197,94,0.25)]
transition-all duration-150
```

### Secondary / outline
```
border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50
```

### Destructive / logout
```
bg-white text-gray-400 rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.05)]
hover:text-red-500 hover:bg-red-50/50 active:scale-[0.97]
```

### Disabled (out of stock)
```
bg-gray-200 text-gray-500 font-bold rounded-2xl py-4
```

---

## Status Badges (Orders)

Pill badges with soft tinted background + matching border:

```
pending:    bg-yellow-50 text-yellow-700 border border-yellow-200/80 font-semibold
confirmed:  bg-blue-50 text-blue-700 border border-blue-200/80
preparing:  bg-purple-50 text-purple-700 border border-purple-200/80
delivering: bg-orange-50 text-orange-700 border border-orange-200/80 font-semibold
delivered:  bg-green-50 text-green-700 border border-green-200/80
cancelled:  bg-red-50 text-red-600 border border-red-200/80
refunded:   bg-gray-100 text-gray-500 border border-gray-200/80
```

`pending` and `delivering` get `font-semibold` — most action-relevant, needs user attention.

---

## Cards

### Product card
```
bg-white rounded-2xl overflow-hidden
border border-gray-100/70
shadow-[0_4px_20px_rgba(0,0,0,0.10)]
active:scale-[0.97] active:shadow-[0_8px_24px_rgba(0,0,0,0.14)]
transition-all duration-150
```

### Section card (profile, addresses)
```
bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)]
```

### Order card
```
bg-white rounded-2xl
shadow-[0_2px_12px_rgba(0,0,0,0.07)] border border-gray-100/80
active:scale-[0.98] active:shadow-[0_4px_16px_rgba(0,0,0,0.11)]
hover:shadow-[0_4px_18px_rgba(0,0,0,0.10)] hover:border-gray-200
transition-all duration-150
```

---

## Hero / Profile Banner

Multi-layer depth approach:
1. Base gradient: `bg-gradient-to-br from-brand-fresh-400 via-brand-fresh-500 to-brand-fresh-700`
2. Radial bloom (top-right): `absolute -top-14 -right-14 w-56 h-56 rounded-full bg-white/10 blur-3xl`
3. Dark anchor (bottom-left): `absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-black/12 blur-2xl`
4. Top shimmer strip: `absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-white/10 to-transparent`
5. Avatar double-ring glow:
   - `absolute inset-0 rounded-full bg-white/15 scale-[1.45] blur-lg`
   - `absolute inset-0 rounded-full bg-white/10 scale-[1.2]`

---

## Layout & Spacing

- Page canvas: `bg-gray-50` — white cards float on soft gray
- Content padding: `px-4`
- Section spacing: `space-y-5` (detail pages) · `space-y-[18px]` (profile)
- List item spacing: `space-y-3.5` (orders)
- Grid: `grid grid-cols-2 gap-4` (product catalog)
- Bottom padding for sticky bar: `pb-28` (profile) · `pb-44` (product detail)

---

## Trust Tile Pattern

Used on product detail page (3-column grid):
```jsx
<div className="bg-brand-fresh-50 rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center">
  <Icon className="h-4 w-4 text-brand-fresh-600" />
  <span className="text-[10px] font-bold leading-tight">{label}</span>
  <span className="text-[9px] text-gray-400 leading-tight">{sub}</span>
</div>
```

---

## Page-specific Notes

### `/products` (Catalog)
- Sticky filter bar: `bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]`
- Urgency strip: `bg-brand-fresh-50 border border-brand-fresh-100` with ⚡ icon

### `/products/[slug]` (Detail)
- Sticky CTA bar: `fixed bottom-16` (sits above bottom nav)
- Qty selector: `bg-gray-100 rounded-2xl` container, `w-9 h-9` touch targets

### `/profile`
- Section order: Pesanan → Loyalty+Wishlist → Stok Habis → WhatsApp → Addresses → Profile → Notif → Logout
- Loyalty goal: 500 pts milestone
- Amber accent = incomplete profile signal

### `/orders`
- `pending` and `delivering` badges are `font-semibold` — action-required states
- Whole card is a `<Link>` — entire surface is tappable
