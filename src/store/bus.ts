// A tiny signal for changes the backend does not announce itself. Opening a thread marks it
// read on the server, but nothing comes back over realtime for that, so the Messages badge
// would sit on a number you have already seen. Whoever reads, emits; whoever counts, listens.
import { useEffect, useState } from 'react';

type Topic = 'inbox';
const listeners: Record<Topic, Set<() => void>> = { inbox: new Set() };

export function emit(topic: Topic) { listeners[topic].forEach(l => l()); }

export function useBus(topic: Topic): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const l = () => setN(x => x + 1);
    listeners[topic].add(l);
    return () => { listeners[topic].delete(l); };
  }, [topic]);
  return n;
}
