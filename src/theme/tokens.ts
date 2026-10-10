// Clubhouse, refined.
//
// A contemporary tennis clubhouse: ivory paper, a deep-green hero, serif headings, one
// restrained court drawing and one small shaded ball. Everything else is flat colour, thin
// lines and quiet whitespace.
//
// Two palettes, picked by the device's appearance setting. The hero, the member card and
// the wordmark dot keep their fixed colours in both. Contrast (WCAG, normal text): muted on
// paper 4.8:1 · ink on paper 11.6:1 · green text on green 13.4:1 · hero copy on hero 8.6:1 ·
// member meta on member 7.9:1 · danger on paper 5.8:1.
import { Platform } from 'react-native';

export type Palette = {
  paper: string;        // the page
  card: string;         // panels, the tab bar
  ink: string;          // main text
  muted: string;        // supporting text
  line: string;         // borders and dividers
  soft: string;         // selected surfaces, the account circle
  green: string;        // the primary action
  greenText: string;    // text on it
  avatar: string;       // monogram fill
  avatarLine: string;   // monogram border
  danger: string;
  dangerSoft: string;
  shadow: string;       // the colour shadows are tinted with
  scrim: string;        // behind a sheet
};

export const light: Palette = {
  paper: '#F5F1E8', card: '#FFFDF7', ink: '#193B2B', muted: '#656D60', line: '#D9DDCE', soft: '#E8EBDF',
  green: '#173D2B', greenText: '#FBF8EC', avatar: '#E0E5D2', avatarLine: '#D1D9BC',
  danger: '#A8371B', dangerSoft: '#F4E3DC', shadow: '#193B2B', scrim: 'rgba(25,59,43,0.45)',
};

export const dark: Palette = {
  paper: '#17241E', card: '#22342A', ink: '#F2EEDF', muted: '#B8C5B5', line: '#435546', soft: '#314537',
  green: '#DFE6CB', greenText: '#173D2B', avatar: '#405437', avatarLine: '#5B704F',
  danger: '#F0A48E', dangerSoft: '#4A2E27', shadow: '#000000', scrim: 'rgba(0,0,0,0.55)',
};

// The same in both appearances.
export const fixed = {
  hero: '#173D2B',
  heroText: '#F6F1DD',
  heroEm: '#E4ECB3',
  heroEyebrow: '#D8DFC4',
  heroCopy: '#D2DDC8',
  heroInset: 'rgba(178,195,156,0.15)',
  art: 'rgba(178,195,156,0.32)',        // the court lines, #b2c39c52
  dot: '#DFFF4F',
  dotLine: '#36593D',
  stripe: '#C5D897',
  member: '#173D2B',
  memberText: '#F3EFDB',
  memberMeta: '#D3DDBE',
  memberLine: '#637E52',
  memberRule: 'rgba(150,173,117,0.25)',  // #96ad753f
  // The ball: a radial gradient from the highlight out to the shaded edge, and the seams.
  ball: ['#EDF2BA', '#C6D983', '#91A452', '#748A3F'] as const,
  ballSeam: 'rgba(247,245,217,0.81)',
  ballShade: 'rgba(86,102,53,0.36)',
} as const;

// Legacy names, so a screen that still says `color.ink` draws the light palette rather
// than failing to compile. New code reads the palette through useTheme().
export const color = {
  paper: light.card, paper2: light.soft, paper3: light.line,
  ground: light.paper, court: light.green, onCourt: light.greenText,
  ball: fixed.dot, onBall: light.green, ink: light.ink, ink2: light.muted, ink3: light.muted,
  hair: light.line, hair2: '#C9CEBD', danger: light.danger, dangerDim: light.dangerSoft,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { xs: 5, sm: 7, md: 9, lg: 13, xl: 15, xxl: 16, pill: 999 } as const;
export const hit = { min: 44, row: 56 } as const;

// DM Serif Display for the editorial voice, DM Sans for everything that works. The
// wordmark alone is a plain heavy sans, which is what makes it a logo and not a heading.
export const font = {
  serif: 'DMSerifDisplay_400Regular',
  serifItalic: 'DMSerifDisplay_400Regular_Italic',
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_600SemiBold',
  wordmark: Platform.select({ ios: 'Arial', android: 'sans-serif', default: 'Arial, Helvetica, sans-serif' }) as string,
  // Old names.
  display: 'DMSerifDisplay_400Regular',
  displayMid: 'DMSerifDisplay_400Regular',
} as const;

// Sizes from the reference at 390 wide. The reference's 9 to 11px labels are lifted to 11
// to 12 so they stay readable; the hierarchy is unchanged.
export const type = {
  hero:    { fontFamily: font.serif, fontSize: 44, lineHeight: 45, letterSpacing: -1.5 },
  display: { fontFamily: font.serif, fontSize: 38, lineHeight: 41, letterSpacing: -1 },
  score:   { fontFamily: font.serif, fontSize: 34, lineHeight: 39, letterSpacing: -1 },
  rating:  { fontFamily: font.serif, fontSize: 29, lineHeight: 32, letterSpacing: -1 },
  h1:      { fontFamily: font.serif, fontSize: 25, lineHeight: 28, letterSpacing: -0.6 },
  h2:      { fontFamily: font.serif, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  body:    { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  bodyM:   { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  small:   { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  smallM:  { fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
  meta:    { fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  micro:   { fontFamily: font.medium, fontSize: 11, lineHeight: 15, letterSpacing: 1.25, textTransform: 'uppercase' as const },
  eyebrow: { fontFamily: font.medium, fontSize: 11, lineHeight: 16, letterSpacing: 1.8, textTransform: 'uppercase' as const },
} as const;
