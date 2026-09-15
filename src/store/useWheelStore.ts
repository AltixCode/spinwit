/**
 * Saved wheels, the active wheel, and the spin history.
 *
 * All drawing rules live in `src/logic/draw.ts`; this holds state and persists it. The free
 * tier caps how many wheels can be *saved*, never what a wheel can do — the wheel, the coin
 * and the dice are all fully usable without paying.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { normaliseEntries } from '@/logic/draw';

export const WHEEL_CACHE_KEY = 'spinwit.state.v1';

/** Saved wheels a free user may keep. */
export const FREE_WHEELS = 3;

export interface Wheel {
  id: string;
  name: string;
  entries: string[];
  /** Parallel to `entries`. All ones unless the user has set weights, which is a paid feature. */
  weights: number[];
}

export interface SpinRecord {
  id: string;
  wheelName: string;
  winner: string;
  at: number;
}

export type Mode = 'wheel' | 'coin' | 'dice';

interface WheelState {
  wheels: Wheel[];
  activeId: string | null;
  mode: Mode;
  /** Kept out of `wheels` so an unsaved wheel can be spun without saving it first. */
  draftEntries: string[];
  history: SpinRecord[];
  removeOnWin: boolean;
  diceCount: number;
  diceSides: number;

  entries: () => string[];
  activeWheel: () => Wheel | null;

  setMode: (mode: Mode) => void;
  setDraftEntries: (entries: string[]) => void;
  addEntry: (entry: string) => boolean;
  removeEntry: (index: number) => void;

  saveWheel: (name: string, isPremium: boolean) => Wheel | 'limit-reached';
  selectWheel: (id: string) => void;
  deleteWheel: (id: string) => void;
  setWeight: (index: number, weight: number) => void;

  recordSpin: (winner: string) => void;
  clearHistory: () => void;
  toggleRemoveOnWin: () => void;
  applyRemoval: (winnerIndex: number) => void;
  setDice: (count: number, sides: number) => void;

  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

let sequence = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${(sequence += 1)}`;

const isWheel = (v: unknown): v is Wheel => {
  if (typeof v !== 'object' || v === null) return false;
  const w = v as Partial<Wheel>;
  return typeof w.id === 'string' && typeof w.name === 'string' && Array.isArray(w.entries);
};

export const useWheelStore = create<WheelState>((set, get) => ({
  wheels: [],
  activeId: null,
  mode: 'wheel',
  draftEntries: [],
  history: [],
  removeOnWin: false,
  diceCount: 2,
  diceSides: 6,

  entries: () => {
    const active = get().activeWheel();
    return active ? active.entries : get().draftEntries;
  },

  activeWheel: () => get().wheels.find((w) => w.id === get().activeId) ?? null,

  setMode: (mode) => set({ mode }),

  setDraftEntries: (entries) => set({ draftEntries: normaliseEntries(entries), activeId: null }),

  addEntry: (entry) => {
    const current = get().entries();
    const next = normaliseEntries([...current, entry]);
    // normaliseEntries drops blanks, duplicates and anything past the cap, so an unchanged
    // length means the entry was rejected and the UI should say so rather than appear to work.
    if (next.length === current.length) return false;
    const active = get().activeWheel();
    if (active) {
      set((s) => ({
        wheels: s.wheels.map((w) =>
          w.id === active.id ? { ...w, entries: next, weights: next.map((_, i) => w.weights[i] ?? 1) } : w,
        ),
      }));
    } else {
      set({ draftEntries: next });
    }
    void get().persist();
    return true;
  },

  removeEntry: (index) => {
    const active = get().activeWheel();
    if (active) {
      set((s) => ({
        wheels: s.wheels.map((w) =>
          w.id === active.id
            ? { ...w, entries: w.entries.filter((_, i) => i !== index), weights: w.weights.filter((_, i) => i !== index) }
            : w,
        ),
      }));
    } else {
      set((s) => ({ draftEntries: s.draftEntries.filter((_, i) => i !== index) }));
    }
    void get().persist();
  },

  saveWheel: (name, isPremium) => {
    const { wheels, draftEntries } = get();
    if (!isPremium && wheels.length >= FREE_WHEELS) return 'limit-reached';
    const entries = normaliseEntries(draftEntries);
    if (entries.length < 2) return 'limit-reached';
    const wheel: Wheel = {
      id: nextId('wheel'),
      name: name.trim() || entries[0]!,
      entries,
      weights: entries.map(() => 1),
    };
    set((s) => ({ wheels: [...s.wheels, wheel], activeId: wheel.id }));
    void get().persist();
    return wheel;
  },

  selectWheel: (id) => {
    set({ activeId: get().wheels.some((w) => w.id === id) ? id : null });
    void get().persist();
  },

  deleteWheel: (id) => {
    set((s) => ({
      wheels: s.wheels.filter((w) => w.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    }));
    void get().persist();
  },

  setWeight: (index, weight) => {
    const active = get().activeWheel();
    if (!active) return;
    const safe = Number.isFinite(weight) && weight > 0 ? weight : 1;
    set((s) => ({
      wheels: s.wheels.map((w) =>
        w.id === active.id ? { ...w, weights: w.weights.map((x, i) => (i === index ? safe : x)) } : w,
      ),
    }));
    void get().persist();
  },

  recordSpin: (winner) => {
    const wheelName = get().activeWheel()?.name ?? '';
    const record: SpinRecord = { id: nextId('spin'), wheelName, winner, at: Date.now() };
    // Capped so a long-lived install cannot grow the store without bound.
    set((s) => ({ history: [record, ...s.history].slice(0, 200) }));
    void get().persist();
  },

  clearHistory: () => {
    set({ history: [] });
    void get().persist();
  },

  toggleRemoveOnWin: () => {
    set((s) => ({ removeOnWin: !s.removeOnWin }));
    void get().persist();
  },

  applyRemoval: (winnerIndex) => {
    const active = get().activeWheel();
    if (active) {
      set((s) => ({
        wheels: s.wheels.map((w) =>
          w.id === active.id
            ? { ...w, entries: w.entries.filter((_, i) => i !== winnerIndex), weights: w.weights.filter((_, i) => i !== winnerIndex) }
            : w,
        ),
      }));
    } else {
      set((s) => ({ draftEntries: s.draftEntries.filter((_, i) => i !== winnerIndex) }));
    }
    void get().persist();
  },

  setDice: (count, sides) => {
    set({
      diceCount: Math.min(Math.max(Math.floor(count) || 1, 1), 10),
      diceSides: Math.min(Math.max(Math.floor(sides) || 6, 2), 100),
    });
    void get().persist();
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(WHEEL_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const wheels = Array.isArray(parsed.wheels)
        ? parsed.wheels.filter(isWheel).map((w) => ({
            ...w,
            entries: normaliseEntries(w.entries),
            weights: normaliseEntries(w.entries).map((_, i) => w.weights?.[i] ?? 1),
          }))
        : [];
      set({
        wheels,
        activeId: typeof parsed.activeId === 'string' && wheels.some((w) => w.id === parsed.activeId)
          ? parsed.activeId
          : null,
        draftEntries: Array.isArray(parsed.draftEntries)
          ? normaliseEntries(parsed.draftEntries.filter((e): e is string => typeof e === 'string'))
          : [],
        removeOnWin: parsed.removeOnWin === true,
        diceCount: typeof parsed.diceCount === 'number' ? parsed.diceCount : 2,
        diceSides: typeof parsed.diceSides === 'number' ? parsed.diceSides : 6,
        history: Array.isArray(parsed.history)
          ? (parsed.history as SpinRecord[]).filter((h) => h && typeof h.winner === 'string').slice(0, 200)
          : [],
      });
    } catch {
      // Corrupt stored state starts clean rather than crashing on launch.
    }
  },

  persist: async () => {
    const { wheels, activeId, draftEntries, history, removeOnWin, diceCount, diceSides } = get();
    try {
      await AsyncStorage.setItem(
        WHEEL_CACHE_KEY,
        JSON.stringify({ wheels, activeId, draftEntries, history, removeOnWin, diceCount, diceSides }),
      );
    } catch {
      // Losing a wheel costs the user retyping it, not the app.
    }
  },
}));
