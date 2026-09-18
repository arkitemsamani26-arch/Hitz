// Center Court.
//
// A hard court in daylight. Sky at the top of every screen, court blue and surround
// green below, white lines, and content on white sheets that sit on the court like a
// scorecard. The ball is you, and the ball colour means "action".
//
// Contrast (WCAG): ink on paper 16.1:1 · ink2 on paper 7.8:1 · ink on ball 14.2:1 ·
// white on court 5.4:1 (18px+ only) · white on ground 5.0:1 (18px+ only) · ink on sky 12.3:1.
// ink3 is 4.6:1 and is reserved for non-essential labels.

export const color = {
  sky: '#BFE3FF',
  sky2: '#EAF6FF',
  ground: '#2E7A45',     // surround green
  ground2: '#256A3A',
  court: '#2E6FCB',      // hard court blue
  court2: '#255FB0',
  line: '#FFFFFF',

  paper: '#FFFFFF',
  paper2: '#F1F5FB',
  paper3: '#E3EAF5',

  ball: '#E5FF3D',
  ballDim: 'rgba(229,255,61,0.35)',
  onBall: '#0E1B33',

  ink: '#0E1B33',
  ink2: '#4A5470',
  ink3: '#7C869E',
  onCourt: '#FFFFFF',

  hair: 'rgba(14,27,51,0.10)',
  hair2: 'rgba(14,27,51,0.20)',
  lineSoft: 'rgba(255,255,255,0.55)',

  danger: '#D63B3B',
  dangerDim: 'rgba(214,59,59,0.12)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const hit = { min: 48, row: 64 } as const;

export const font = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayMid: 'BricolageGrotesque_600SemiBold',
  bold: 'InstrumentSans_600SemiBold',
  medium: 'InstrumentSans_500Medium',
  regular: 'InstrumentSans_400Regular',
} as const;

export const type = {
  score:   { fontFamily: font.display, fontSize: 64, lineHeight: 64, letterSpacing: -3 },
  display: { fontFamily: font.display, fontSize: 40, lineHeight: 40, letterSpacing: -1.6 },
  h1:      { fontFamily: font.display, fontSize: 28, lineHeight: 30, letterSpacing: -1 },
  h2:      { fontFamily: font.displayMid, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
  body:    { fontFamily: font.regular, fontSize: 16, lineHeight: 22 },
  bodyM:   { fontFamily: font.medium, fontSize: 16, lineHeight: 22 },
  small:   { fontFamily: font.regular, fontSize: 14, lineHeight: 18 },
  smallM:  { fontFamily: font.medium, fontSize: 14, lineHeight: 18 },
  micro:   { fontFamily: font.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' as const },
} as const;
