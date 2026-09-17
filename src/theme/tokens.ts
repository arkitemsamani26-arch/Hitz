// Night Match.
//
// Near-black court blue as the ground. Optic yellow is the entire energy budget: it
// means "action" and nothing else, so it lands every time it appears. Court lines are
// layout structure, not decoration.
//
// Contrast (WCAG, against `court`):  ink 17.8:1 · ink2 9.1:1 · ball 16.4:1 · cyan 12.1:1
// ink3 is 4.6:1 and is reserved for non-essential labels only.

export const color = {
  court: '#0B1220',      // ground
  court2: '#111A2E',     // raised surface
  court3: '#18233B',     // card
  court4: '#22304D',     // pressed / hairline fill

  line: 'rgba(255,255,255,0.14)',
  lineStrong: 'rgba(255,255,255,0.30)',
  lineFaint: 'rgba(255,255,255,0.07)',

  ball: '#DFFF4F',
  ballDim: 'rgba(223,255,79,0.16)',
  ballGlow: 'rgba(223,255,79,0.45)',
  onBall: '#0B1220',

  ink: '#F3F6FF',
  ink2: '#A9B3C9',
  ink3: '#6B7690',

  cyan: '#7FD8FF',
  cyanDim: 'rgba(127,216,255,0.16)',

  danger: '#FF7A7A',
  dangerDim: 'rgba(255,122,122,0.16)',
} as const;

export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
} as const;

export const radius = {
  sm: 10, md: 16, lg: 22, pill: 999,
} as const;

// Tap targets sized for a phone held in a tennis bag.
export const hit = {
  min: 48,
  row: 64,
} as const;

export const font = {
  black: 'Archivo_900Black',
  bold: 'Archivo_700Bold',
  medium: 'Archivo_500Medium',
  regular: 'Archivo_400Regular',
} as const;

export const type = {
  score:   { fontFamily: font.black,   fontSize: 64, lineHeight: 64, letterSpacing: -2 },
  display: { fontFamily: font.black,   fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  h1:      { fontFamily: font.bold,    fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
  h2:      { fontFamily: font.bold,    fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  body:    { fontFamily: font.regular, fontSize: 16, lineHeight: 22 },
  bodyM:   { fontFamily: font.medium,  fontSize: 16, lineHeight: 22 },
  small:   { fontFamily: font.regular, fontSize: 14, lineHeight: 18 },
  smallM:  { fontFamily: font.medium,  fontSize: 14, lineHeight: 18 },
  micro:   { fontFamily: font.bold,    fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' as const },
} as const;
