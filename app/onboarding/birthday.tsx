import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Field } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Screen';
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
    <Screen bottom={<Centered><Button title="Next" arrow onPress={go} disabled={!dob || tooYoung} /></Centered>}>
      <Centered>
        <T v="eyebrow" tone="muted" style={{ marginTop: space.xl }}>Private</T>
        <T v="display" style={{ marginTop: 12 }}>When's your{'\n'}<T v="display" italic>birthday?</T></T>
        <T v="small" tone="muted" style={{ marginTop: space.md, marginBottom: space.lg, lineHeight: 21 }}>Nobody sees this. We match you by level, not age. Under 18, a parent approves each meetup.</T>
        <Field big value={v} onChangeText={onChange} placeholder="MM / DD / YYYY" keyboardType="number-pad" inputMode="numeric" autoFocus accessibilityLabel="Birthday, month day year" onSubmitEditing={go} />
        {tooYoung && <T v="body" tone="danger" style={{ marginTop: space.lg }}>Hits is for 13 and up. Come back on your birthday.</T>}
        {dob && !tooYoung && (
          <Card style={{ marginTop: space.lg }}>
            {minor
              ? <><T v="bodyM">Under 18: you find the hit, a parent approves the meetup.</T><T v="meta" tone="muted" style={{ marginTop: 4 }}>That's the only difference. Browsing, inviting and chatting are all yours.</T></>
              : <><T v="bodyM">18 and over: you're set.</T><T v="meta" tone="muted" style={{ marginTop: 4 }}>You'll see adult players, and they'll see you.</T></>}
          </Card>
        )}
      </Centered>
    </Screen>
  );
}
