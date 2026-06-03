/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* teal accent — industrial gas cylinder imagery */
        'teal': '#0d9488',
        'teal-light': '#ccfbf1',
        'teal-dim': '#0f766e',

        /* brand */
        primary: '#0056c6',
        'primary-container': '#076df6',
        'primary-fixed': '#d9e2ff',
        'primary-fixed-dim': '#b0c6ff',
        'on-primary': '#ffffff',
        'on-primary-container': '#fefcff',
        'on-primary-fixed': '#001945',
        'on-primary-fixed-variant': '#00429b',
        'inverse-primary': '#b0c6ff',

        secondary: '#505f76',
        'secondary-container': '#d0e1fb',
        'secondary-fixed': '#d3e4fe',
        'secondary-fixed-dim': '#b7c8e1',
        'on-secondary': '#ffffff',
        'on-secondary-container': '#54647a',
        'on-secondary-fixed': '#0b1c30',
        'on-secondary-fixed-variant': '#38485d',

        tertiary: '#9e3d00',
        'tertiary-container': '#c64f00',
        'tertiary-fixed': '#ffdbcc',
        'tertiary-fixed-dim': '#ffb695',
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#fffbff',
        'on-tertiary-fixed': '#351000',
        'on-tertiary-fixed-variant': '#7c2e00',

        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error': '#ffffff',
        'on-error-container': '#93000a',

        /* surfaces — background is now neutral gray, surface is pure white */
        background: '#F3F4F8',
        surface: '#ffffff',
        'surface-bright': '#ffffff',
        'surface-dim': '#dde0ea',
        'surface-variant': '#e1e2ed',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f3ff',
        'surface-container': '#ecedf9',
        'surface-container-high': '#e6e7f3',
        'surface-container-highest': '#e1e2ed',
        'inverse-surface': '#2d3039',
        'inverse-on-surface': '#eff0fc',

        /* text */
        'on-surface': '#191b23',
        'on-surface-variant': '#424655',
        'on-background': '#191b23',

        /* borders */
        outline: '#727786',
        'outline-variant': '#E2E5EF',

        /* misc */
        'surface-tint': '#0058cb',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      spacing: {
        margin: '24px',
        xs: '4px',
        xl: '32px',
        md: '16px',
        unit: '4px',
        gutter: '16px',
        lg: '24px',
        sm: '8px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        h1: ['36px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        h2: ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label-sm': ['12px', { lineHeight: '1.2', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        'nav': '2px 0 8px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
