// The palette for the current appearance, and a way to build stylesheets against it.
import { StyleSheet, useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export function useScheme(): 'light' | 'dark' {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useTheme(): Palette {
  return useScheme() === 'dark' ? dark : light;
}

// Both sheets are built once, at module load; the hook only picks one. So a component
// can keep writing `const s = useStyles()` and `style={s.row}` exactly as it did with a
// static StyleSheet.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(build: (c: Palette) => T & StyleSheet.NamedStyles<any>): () => T {
  const l = StyleSheet.create(build(light));
  const d = StyleSheet.create(build(dark));
  return () => (useColorScheme() === 'dark' ? d : l);
}
