# Vitalis Design System

## Product Context

**Who**: Gabriel, owner-operator of a small Brazilian gas distribution company. Manages orders, clients, stock, bottle loans, and payments himself — often on the fly between deliveries.

**What they must do**: Register new orders in under 30 seconds. Know immediately who owes money. See which bottles haven't come back. Confirm deliveries. Never run out of stock without warning.

**How it should feel**: A dispatch control room. Authoritative and organized. The weight of real logistics — pressure gauges, manifests, routes. Not the playful SaaS of consumer apps. Industrial premium: precise, high-contrast, efficient.

---

## Domain

Concepts native to this product's world: propane cylinder custody, FIFO payment allocation, delivery manifest, stock pressure (critical vs. normal), bottle loan aging, fidelity liters, reseller margin, debt balance, route status.

**Colors drawn from the domain**: Deep navy of industrial gas tanks (sidebar). Amber of low-fuel warnings (tertiary). The blue of compressed gas cylinders (primary). The orange-red of a propane flame (alerts). Clean white of delivery receipts (surface).

**Signature element**: The bottle loan counter — an aging tracker showing exactly how many cylinders are in the field by client, with elapsed days coloring the urgency. Unique to this product's world.

**Defaults consciously rejected**:
1. Generic blue primary (we own our shade: #0056c6 — Vital Blue, specific and saturated)
2. Equal white card grids (we use surface elevation hierarchy to create visual priority)
3. Pill badges for everything (status uses semantic color-fill, not pill shape uniformity)

---

## Color Tokens

All tokens from `tailwind.config.js`. Key semantic uses:

### Surfaces (light layering — never jump more than 2 levels)
```
background:                  #faf8ff  — page canvas (slightly warm, not cold grey)
surface:                     #faf8ff  — primary card surface
surface-container-lowest:    #ffffff  — elevated cards, modals, table rows
surface-container-low:       #f2f3ff  — table headers, subtle sections
surface-container:           #ecedf9  — hover states, pressed surfaces
surface-container-high:      #e6e7f3  — secondary headers
surface-container-highest:   #e1e2ed  — dividers, icon backgrounds
```

### Brand
```
primary:          #0056c6  — CTA buttons, active states, links
on-primary:       #ffffff
primary-container: #076df6  — icon containers (lighter contexts)
primary-fixed:    #d9e2ff  — subtle highlights, ADMIN badges
primary-fixed-dim: #b0c6ff  — sidebar active text
tertiary:         #9e3d00  — fidelity, warnings, amber signals
tertiary-fixed:   #ffdbcc  — fidelity card backgrounds
```

### Navigation (Sidebar)
```
on-secondary-fixed:         #0b1c30  — sidebar background (deep industrial navy)
on-secondary-fixed-variant: #38485d  — sidebar hover
secondary-fixed-dim:        #b7c8e1  — sidebar inactive text
teal:                        #0d9488  — active icon color, left-border accent, logo icon bg
teal-dim:                    #0f766e  — hover state on teal buttons
teal-light:                  #ccfbf1  — teal badge backgrounds (light contexts)
```

### Semantic
```
error:            #ba1a1a  — destructive, debt, overdue
error-container:  #ffdad6  — error message backgrounds
outline-variant:  #c2c6d7  — borders, dividers
outline:          #727786  — secondary text, placeholder icons
on-surface:       #191b23  — primary text
on-surface-variant: #424655 — secondary text
```

---

## Typography

**Font**: Inter exclusively. No mixing.

```
h1:       36px / weight 600 / tracking -0.02em  — page titles only
h2:       24px / weight 600 / tracking -0.01em  — section headers, modal titles
h3:       18px / weight 600 / tracking 0        — card titles, table section headers
body-lg:  16px / weight 400                     — descriptions under page titles
body-md:  14px / weight 400                     — table data, form labels, body
label-sm: 12px / weight 600 / tracking +0.05em  — uppercase labels, badges, metadata
```

**Rules**:
- Page titles (`h1`) appear once per page at the top, never repeated
- Numbers in KPI cards use `font-black` (900) — weight conveys data importance
- Monospace font only for IDs (`font-mono`) and currency values in tables
- Badge/status text always `font-bold uppercase tracking-tight text-[10px]`

---

## Spacing

Base unit: 4px. All spacing is multiples of 4.

```
xs: 4px   — internal gaps within dense components
sm: 8px   — between related elements (icon + label)
md: 16px  — between groups within a card
lg: 24px  — between cards, section spacing
xl: 32px  — between major page sections
```

**Page layout**: `p-6` (24px) all sides, `max-w-7xl mx-auto`, `space-y-6` between sections.

**Cards**: `p-5` (20px) standard cards, `p-6` (24px) for modals and detail panels.

**Table rows**: `px-6 py-4` for data rows, `px-6 py-3` for compact/dense rows with multiple lines.

---

## Elevation & Depth

Three levels. Never skip a level.

| Level | Usage | Pattern |
|-------|-------|---------|
| 0 — Canvas | Page background | `bg-background` |
| 1 — Surface | Cards, table containers | `bg-surface border border-outline-variant rounded-xl shadow-sm` |
| 2 — Elevated | Modal dialogs, dropdowns, popovers | `bg-surface rounded-xl shadow-2xl` |

**Border rule**: Always `border-outline-variant` at opacity 1 — never `border-gray-*`. The warm lavender-grey of `#c2c6d7` reads as part of the surface, not a cage around it.

**No shadow stacking** — a card has `shadow-sm`. Its modal has `shadow-2xl`. Nothing in between.

---

## Shapes

```
rounded-xl (0.75rem / 12px) — cards, modals, table containers, filter panels
rounded-lg (0.5rem / 8px)  — buttons, inputs, badges, small cards
rounded     (0.25rem / 4px) — table rows (none), status chips
rounded-full               — avatars, circular buttons, dot indicators
```

**Rule**: Only `rounded-xl` for containers that hold content. `rounded-lg` for interactive controls. Never `rounded-2xl` or larger — it reads toy-like in industrial context.

---

## Components

### Buttons

**Primary CTA**:
```
bg-primary text-on-primary rounded-lg font-bold
hover:brightness-110 active:scale-95 transition-all
shadow-md shadow-primary/20
```
Use `gap-2` with a Material Symbol icon on the left. Max one primary CTA per page section.

**Destructive**:
```
bg-error text-on-error rounded-lg font-bold
hover:brightness-110 active:scale-95 transition-all
```

**Ghost/Secondary**:
```
border border-outline-variant text-on-surface-variant rounded-lg font-bold
hover:bg-surface-container-low transition-colors
```

**Icon actions (table rows)**:
```
p-2 rounded-lg transition-colors
— view:   text-primary hover:bg-primary/10
— edit:   text-on-surface-variant hover:bg-surface-container
— delete: text-error hover:bg-error/10
```
Actions are always visible (not hidden on hover) for accessibility in this context.

### Cards (KPI / Stats)

```
bg-surface border border-outline-variant rounded-xl p-5 shadow-sm
```
Interior structure:
- Icon badge top-left: `p-2 bg-[color]/10 rounded-lg`
- Metric: `text-h2 text-on-surface font-black` (never `font-bold` for KPI numbers)
- Label: `text-sm font-medium text-on-surface-variant`

**Accent card** (dark): Use `bg-on-secondary-fixed text-white` for one card per section — creates focal hierarchy without gradients.

### Tables

Container:
```
bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm
```

Header row:
```
bg-surface-container-low border-b border-outline-variant
th: px-6 py-4 text-label-sm text-on-surface-variant uppercase
```

Data rows:
```
divide-y divide-outline-variant
tr: hover:bg-surface-container transition-colors
td: px-6 py-4 text-body-md
```

### Status Badges

Order status:
```
PENDING:   bg-yellow-100 text-yellow-700
SHIPPED:   bg-blue-100 text-blue-700
DELIVERED: bg-green-100 text-green-700
CANCELLED: bg-red-100 text-red-700
```

Payment status:
```
PENDING (Aguardando): bg-orange-100 text-orange-700
PARTIAL:              bg-yellow-100 text-yellow-700
PAID:                 bg-green-100 text-green-700
```

Client status:
```
OVERDUE: bg-red-100 text-red-700
PAID:    bg-green-100 text-green-700
```

Always: `px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide`

### Inputs / Forms

```
border border-outline-variant rounded-lg bg-surface-container-low text-body-md
py-2.5 px-3 (standard) | py-2 px-3 (compact in tables)
focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all
```

Labels: `block text-label-sm text-on-surface-variant uppercase mb-1.5`

### Modals

```
fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4
inner: bg-surface rounded-xl shadow-2xl w-full max-w-[size] max-h-[90vh] flex flex-col
header: flex items-center justify-between px-6 py-4 border-b border-outline-variant
body: overflow-y-auto flex-1 p-6
```

### Sidebar Navigation

Container: `w-64 h-screen sticky top-0 bg-on-secondary-fixed shadow-lg`

**Structure**:
- Logo area: teal rounded icon (`bg-teal w-9 h-9 rounded-lg`) + "Vitalis" bold + "LOGISTICS" label
- Groups: each with a `text-[10px] font-bold tracking-[0.12em] text-secondary-fixed-dim/40 uppercase` label
- Groups: GERAL / PRODUTOS / OPERAÇÕES / SISTEMA
- Expandable parent items have `expand_more` chevron (rotates 180° when open)
- Sub-items indented `ml-3 pl-3 border-l border-on-secondary-fixed-variant/30`
- "EM BREVE" badge on unimplemented routes

Active link (top-level):
```
text-white bg-on-secondary-fixed-variant/40 border-l-2 border-teal
icon: text-teal
```

Active link (sub-item):
```
text-white bg-on-secondary-fixed-variant/40 border-l-2 border-teal
icon: text-teal, fontSize: '15px'
```

Inactive link:
```
text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant/30 hover:text-white transition-all
```

Footer: user avatar (teal circle + initial) + username + admin label + logout icon button

Icons: Material Symbols Outlined, `fontSize: '18px'` (nav), `'15px'` (sub-items).

### Topbar

```
h-14 bg-surface border-b border-outline-variant sticky top-0 z-40
flex items-center justify-between px-6
```

- Search input: `w-60 pl-9 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-[13px]`
- Notification bell: relative button with `w-2 h-2 rounded-full bg-teal` dot badge
- User avatar: `w-8 h-8 rounded-full bg-teal text-white font-black text-sm`
- Optional `title`/`subtitle` props replace the search bar for per-page context

---

## Motion

- Transitions: `transition-colors` (instant color), `transition-all` (scale + color combined)
- Hover: `hover:brightness-110` on primary buttons — never change hue on hover, only luminosity
- Click: `active:scale-95` on primary CTAs only
- Dropdowns: `position: fixed` with `getBoundingClientRect()` — never `position: absolute` inside overflow containers
- Status menus: `z-9999`, render outside table DOM to avoid clipping

---

## Icon System

Material Symbols Outlined exclusively. Size rules:
```
20px — sidebar navigation, action buttons, inline with text
18px — button icons, form field prefixes
16px — badge/chip icons, dropdown menu items
28–32px — KPI card icons
```

Never mix filled and outlined in the same component.

---

## Data Display Patterns

**Monetary values**: `formatBRL()` — always `font-bold`, negative in `text-error`
**Order IDs**: `formatOrderId()` — `font-mono font-semibold text-primary` (short hex suffix)
**Dates in tables**: `formatShortDateTime()` — `dd/mm HH:mm` — no year in dense contexts
**Dates in detail views**: `formatDateTime()` — full format
**Item lists in table rows**: `text-[11px] text-on-surface-variant` with `font-bold text-on-surface` for the count (e.g. `Galão 20L ×2`)
**Client initials avatar**: `w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container font-bold text-xs`

---

## Page Structure Template

```tsx
<>
  <TopBar />
  <div className="p-6 max-w-7xl mx-auto space-y-6">

    {/* Header */}
    <div className="flex justify-between items-end">
      <div>
        <h1 className="text-h1 text-on-surface">[Page Title]</h1>
        <p className="text-body-lg text-on-surface-variant">[Description]</p>
      </div>
      <button className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary
        rounded-lg text-sm font-bold shadow-md shadow-primary/20
        hover:brightness-110 active:scale-95 transition-all">
        [Primary Action]
      </button>
    </div>

    {/* KPI Cards (optional) */}
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/*
        3 metric cards (bg-surface border) + 1 dark accent card (bg-on-secondary-fixed)
        Use KpiCard component with dark prop for accent slot.
        Icon size: 22px. Value: text-[32px] font-black. Label: text-[11px] uppercase tracking-widest.
        Badge: text-[10px] px-2 py-0.5 rounded-full uppercase.
      */}
    </section>

    {/* Main Table */}
    <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
      {/* ... */}
    </section>

  </div>
</>
```
