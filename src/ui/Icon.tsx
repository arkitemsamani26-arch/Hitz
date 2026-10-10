// Icons. The Lucide outline set (ISC licence, Copyright (c) Lucide Icons and Contributors),
// reduced to the 34 glyphs this app draws so the bundle does not carry the other
// three thousand. Path data is copied unchanged from lucide-react-native 1.54.0.
//
// Decorative by default: an icon next to a label is hidden from assistive tech, and the
// label does the talking. Pass `label` when the icon stands alone.
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/theme';

type Node = [string, Record<string, string | number>];
const ICONS = {
  'compass': [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"}]],
  'calendar-days': [["path",{"d":"M8 2v3"}],["path",{"d":"M16 2v3"}],["rect",{"x":"3","y":"3","width":"18","height":"18","rx":"2"}],["path",{"d":"M3 9h18"}],["path",{"d":"M8 13h.01"}],["path",{"d":"M12 13h.01"}],["path",{"d":"M16 13h.01"}],["path",{"d":"M8 17h.01"}],["path",{"d":"M12 17h.01"}],["path",{"d":"M16 17h.01"}]],
  'id-card': [["path",{"d":"M13 19a4 4 0 00-8 0"}],["path",{"d":"M16 10h2"}],["path",{"d":"M16 14h2"}],["circle",{"cx":"9","cy":"12","r":"3"}],["rect",{"x":"2","y":"5","width":"20","height":"14","rx":"2"}]],
  'sliders-horizontal': [["path",{"d":"M10 5H3"}],["path",{"d":"M12 19H3"}],["path",{"d":"M14 3v4"}],["path",{"d":"M16 17v4"}],["path",{"d":"M21 12h-9"}],["path",{"d":"M21 19h-5"}],["path",{"d":"M21 5h-7"}],["path",{"d":"M8 10v4"}],["path",{"d":"M8 12H3"}]],
  'calendar-check-2': [["path",{"d":"M 19 3 L 5 3"}],["path",{"d":"M 21 13 L 21 5"}],["path",{"d":"M 21 5 A2 2 0 0 0 19 3"}],["path",{"d":"M 3 19 A2 2 0 0 0 5 21"}],["path",{"d":"M 3 5 L 3 19"}],["path",{"d":"M 5 3 A2 2 0 0 0 3 5"}],["path",{"d":"m16 19 2 2 4-4"}],["path",{"d":"M16 2v3"}],["path",{"d":"M3 9h18"}],["path",{"d":"M5 21 L12.5 21"}],["path",{"d":"M8 2v3"}]],
  'arrow-up-right': [["path",{"d":"M7 7h10v10"}],["path",{"d":"M7 17 17 7"}]],
  'arrow-left': [["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]],
  'clock-3': [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 6v6h4"}]],
  'x': [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],
  'map-pin': [["path",{"d":"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}],["circle",{"cx":"12","cy":"10","r":"3"}]],
  'message-circle': [["path",{"d":"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"}]],
  'ellipsis': [["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"19","cy":"12","r":"1"}],["circle",{"cx":"5","cy":"12","r":"1"}]],
  'share': [["path",{"d":"M12 2v13"}],["path",{"d":"m16 6-4-4-4 4"}],["path",{"d":"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"}]],
  'log-out': [["path",{"d":"m16 17 5-5-5-5"}],["path",{"d":"M21 12H9"}],["path",{"d":"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}]],
  'user-round': [["circle",{"cx":"12","cy":"8","r":"5"}],["path",{"d":"M20 21a8 8 0 0 0-16 0"}]],
  'bell': [["path",{"d":"M10.268 21a2 2 0 0 0 3.464 0"}],["path",{"d":"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"}]],
  'pencil': [["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{"d":"m15 5 4 4"}]],
  'users': [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["path",{"d":"M16 3.128a4 4 0 0 1 0 7.744"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["circle",{"cx":"9","cy":"7","r":"4"}]],
  'shield': [["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}]],
  'camera': [["path",{"d":"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"}],["circle",{"cx":"12","cy":"13","r":"3"}]],
  'phone': [["path",{"d":"M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"}]],
  'flag': [["path",{"d":"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"}]],
  'ban': [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M4.929 4.929 19.07 19.071"}]],
  'circle-alert': [["circle",{"cx":"12","cy":"12","r":"10"}],["line",{"x1":"12","x2":"12","y1":"8","y2":"12"}],["line",{"x1":"12","x2":"12.01","y1":"16","y2":"16"}]],
  'info': [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]],
  'plus': [["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],
  'refresh-cw': [["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}],["path",{"d":"M8 16H3v5"}]],
  'search': [["path",{"d":"m21 21-4.34-4.34"}],["circle",{"cx":"11","cy":"11","r":"8"}]],
  'calendar': [["path",{"d":"M8 2v3"}],["path",{"d":"M16 2v3"}],["rect",{"x":"3","y":"3","width":"18","height":"18","rx":"2"}],["path",{"d":"M3 9h18"}]],
  'lock': [["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4"}]],
  'users-round': [["path",{"d":"M18 21a8 8 0 0 0-16 0"}],["circle",{"cx":"10","cy":"8","r":"5"}],["path",{"d":"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"}]],
  'send': [["path",{"d":"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}],["path",{"d":"m21.854 2.147-10.94 10.939"}]],
  'check': [["path",{"d":"M20 6 9 17l-5-5"}]],
  'chevron-right': [["path",{"d":"m9 18 6-6-6-6"}]],
} as const satisfies Record<string, readonly Node[]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 17, color, strokeWidth = 1.65, style, label }:
  { name: IconName; size?: number; color?: string; strokeWidth?: number; style?: StyleProp<ViewStyle>; label?: string }) {
  const t = useTheme();
  const stroke = color ?? t.ink;
  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, 'aria-hidden': true };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style} {...a11y}>
      {ICONS[name].map((n, i) => {
        const [tag, p] = n as Node;
        if (tag === 'path') return <Path key={i} d={String(p.d)} />;
        if (tag === 'circle') return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} />;
        if (tag === 'rect') return <Rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} ry={p.ry} />;
        if (tag === 'line') return <Line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />;
        if (tag === 'polyline') return <Polyline key={i} points={String(p.points)} />;
        return null;
      })}
    </Svg>
  );
}
