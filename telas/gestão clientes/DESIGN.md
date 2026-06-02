---
name: Vitalis Logistics System
colors:
  surface: '#faf8ff'
  surface-dim: '#d8d9e5'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#ecedf9'
  surface-container-high: '#e6e7f3'
  surface-container-highest: '#e1e2ed'
  on-surface: '#191b23'
  on-surface-variant: '#424655'
  inverse-surface: '#2d3039'
  inverse-on-surface: '#eff0fc'
  outline: '#727786'
  outline-variant: '#c2c6d7'
  surface-tint: '#0058cb'
  primary: '#0056c6'
  on-primary: '#ffffff'
  primary-container: '#076df6'
  on-primary-container: '#fefcff'
  inverse-primary: '#b0c6ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#9e3d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c64f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00429b'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7c2e00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ed'
typography:
  h1:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 24px
---

## Brand & Style

The brand personality of this design system is rooted in **Precision, Velocity, and Reliability.** Designed for high-stakes logistics management, the UI avoids the playfulness of consumer apps in favor of an "Industrial Premium" aesthetic. It evokes the feeling of a modern global control tower: organized, high-visibility, and authoritative.

The design style follows a **Corporate Modern** approach with a heavy emphasis on information density and functional clarity. By utilizing a high-contrast text hierarchy against pure white surfaces, the system ensures that dispatchers and fleet managers can identify critical data points at a glance. The aesthetic is defined by its architectural rigor—using subtle borders to define space rather than heavy shadows or vibrant gradients.

## Colors

The color strategy centers on the **Vital Blue (#1F75FE)**, a high-chroma primary used exclusively for critical actions and active states. This ensures that in a sea of logistics data, the path to progress is always unmistakable.

The environment utilizes a dual-surface approach: **Pure White (#FFFFFF)** is reserved for interactive cards, data tables, and modal containers, while **Light Grey (#F8FAFC)** provides the foundational canvas, creating a sophisticated "layered" effect. To maintain the enterprise logistics aesthetic, neutral tones are pulled from a slate-blue spectrum to prevent the UI from feeling "warm" or "soft," instead keeping it clinical and efficient. High-contrast text (#0F172A) ensures accessibility and legibility in fast-paced operational environments.

## Typography

This design system utilizes **Inter** exclusively to leverage its utilitarian, neutral characteristics. To achieve the required professional data density, the system employs a compact scale with tight line heights.

Headers are set in **Semi-Bold (600)** weight to provide a strong structural anchor for content sections. For data-heavy contexts, the system prioritizes "label-sm" for metadata—using semi-bold weights and slight tracking increases to ensure small-scale legibility. Body text is kept at a 14px baseline for the majority of the ERP interface to maximize the information visible on screen without sacrificing readability.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model, allowing the dashboard to scale from laptop screens to large logistics monitoring displays. The system is built on a 12-column grid with 16px gutters, providing a rigorous structure for data alignment.

Spacing is governed by a 4px base unit, but the "enterprise logistics" aesthetic specifically uses tighter vertical padding (sm/8px) within rows and lists to increase data density, while using more generous horizontal margins (lg/24px) to group related content. This "tight-in, wide-out" approach keeps complex forms and tables feeling manageable.

## Elevation & Depth

This design system uses a **Low-Contrast Outline** and **Ambient Shadow** approach. Depth is not used for decoration but for functional separation.

- **Level 0 (Canvas):** The #F8FAFC background.
- **Level 1 (Surface):** Pure #FFFFFF surfaces with a 1px solid #E2E8F0 border. These are used for standard dashboard widgets and table containers.
- **Level 2 (Interaction):** When a user interacts with a card or element, a **shadow-sm** (0 1px 2px 0 rgba(15, 23, 42, 0.05)) is applied. This is a very diffused, low-opacity shadow that lifts the element slightly without breaking the clean, flat aesthetic.
- **Level 3 (Overlay):** Modals and dropdowns use a slightly more pronounced shadow with a wider blur to indicate they are temporary layers above the main application state.

## Shapes

The shape language balances the rigid nature of logistics with a premium, modern feel. A **Rounded (Level 2)** configuration is applied across the system.

Small components like input fields and buttons utilize a **0.5rem (8px)** radius, while larger containers such as shipment cards and dashboard panels use **1rem (16px)**. This differentiation ensures that the overall interface feels approachable and high-end, while the individual interactive elements maintain a precise, "tool-like" appearance.

## Components

### Buttons
Primary buttons utilize the **Vital Blue** background with white text. They feature a 0.5rem radius and no gradient, relying on a subtle brightness shift on hover. Secondary buttons use a transparent background with the #E2E8F0 border.

### Cards & Data Tables
Tables are the heart of the system. Rows should have a fixed height (typically 48px or 56px) with 1px bottom borders. The header row should use a slightly darker grey background (#F1F5F9) and Semi-Bold labels to distinguish it from the data entries.

### Status Chips
Critical for logistics, status chips (e.g., "In Transit", "Delayed", "Delivered") should use a "Pill" shape with a low-opacity background tint of their semantic color (e.g., green for delivered) and high-contrast text of the same hue.

### Input Fields
Inputs are defined by their #E2E8F0 border. When focused, the border transitions to Vital Blue with a subtle 2px blue "glow" (spread shadow) to provide clear feedback during rapid data entry.

### Additional Logistics Components
- **Shipment Timeline:** A vertical stepper with 2px connecting lines.
- **KPI Metrics:** Large-format numbers with high-contrast weight and Vital Blue trend indicators.
- **Inventory Tags:** Small-scale label components used for SKU and warehouse location identification.