import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Screen';
import { space } from '@/theme/tokens';
import { useDraft, isMinor } from '@/store/onboarding';

function parse(v: string): string | null {
  const m = v.match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/); if (!m) return null;
  const [, mm, dd, yyyy] = m; const d = new Date(+yyyy, +mm - 1, +dd);
  if (d.getMonth() !== +mm - 1 || d > new Date() || +yyyy < 1920) return null;
  return `${yyyy}-${mm}-${dd}`;
}
function ageOf(iso: string) { const d = new Date(iso); const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }

export default function Birthday() {
  const router = useRouter();
  const { patch } = useDraft();
  const [v, setV] = useState('');
  const dob = useMemo(() => parse(v), [v]);
  const age = dob ? ageOf(dob) : null;
  const tooYoung = age != null && age < 13;
  const minor = dob ? isMinor(dob) : false;
  const onChange = (t: string) => {
    const d = t.replace(/\D/g, '').slice(0, 8);
    setV(d.length > 4 ? `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d);
  };
  const go = () => { if (!dob || tooYoung) return; patch({ dateOfBirth: dob }); router.push('/onboarding/level'); };
  return (
    <Screen sky={250} bottom={<Centered><Button title="Next" kind="ball" onPress={go} disabled={!dob || tooYoung} /></Centered>}>
      <Centered>
        <T v="display" style={{ marginTop: space.xl }}>When's your{'\n'}birthday?</T>
        <T v="body" tone="ink2" style={{ marginTop: space.md, marginBottom: space.lg }}>Nobody sees this. We match you by level, not age.</T>
        <Field big value={v} onChangeText={onChange} placeholder="MM / DD / YYYY" keyboardType="number-pad" inputMode="numeric" autoFocus accessibilityLabel="Birthday, month day year" onSubmitEditing={go} />
        {tooYoung && <T v="body" tone="onCourt" style={{ marginTop: space.lg }}>Hits is for 13 and up. Come back on your birthday.</T>}
        {dob && !tooYoung && (
          <Sheet style={{ marginTop: space.lg }}>
            {minor
              ? <><T v="bodyM">Under 18: you find the hit, a parent approves the meetup.</T><T v="small" tone="ink2" style={{ marginTop: 4 }}>That's the only difference. Browsing, requesting and chatting are all yours.</T></>
              : <><T v="bodyM">18+: you're set.</T><T v="small" tone="ink2" style={{ marginTop: 4 }}>You'll see adult players, and they'll see you.</T></>}
          </Sheet>
        )}
      </Centered>
    </Screen>
  );
}
