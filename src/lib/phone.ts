// Phone numbers: what people type, what the SMS provider needs, and what we show back.
//
// Supabase Auth (and Twilio behind it) wants E.164: "+16505550137". People type
// "(650) 555-0137", "650.555.0137" or "1 650 555 0137". Hits launches in the US, so a bare
// ten-digit number is a US number; anything starting with + is taken as already
// international.

export function digitsOf(s: string): string { return s.replace(/\D/g, ''); }

export function toE164(input: string): string | null {
  const t = input.trim();
  const d = digitsOf(t);
  if (t.startsWith('+')) return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

// As you type: "650", "(650) 555", "(650) 555-0137". International numbers are left alone.
export function formatTyping(input: string): string {
  if (input.trim().startsWith('+')) return input;
  let d = digitsOf(input);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function display(e164OrTyped: string): string {
  const d = digitsOf(e164OrTyped);
  if (d.length === 11 && d.startsWith('1')) return formatTyping(d.slice(1));
  if (d.length === 10) return formatTyping(d);
  return e164OrTyped;
}
