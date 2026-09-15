import AsyncStorage from '@react-native-async-storage/async-storage';

import { FREE_WHEELS, WHEEL_CACHE_KEY, useWheelStore } from '../useWheelStore';
import { MAX_ENTRIES } from '@/logic/draw';

const initial = useWheelStore.getState();
const S = () => useWheelStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useWheelStore.setState(initial, true);
});

describe('entries', () => {
  it('adds to the draft when no wheel is selected', () => {
    expect(S().addEntry('Pizza')).toBe(true);
    expect(S().entries()).toEqual(['Pizza']);
  });

  it('refuses a blank entry and says so', () => {
    expect(S().addEntry('   ')).toBe(false);
    expect(S().entries()).toEqual([]);
  });

  it('refuses a duplicate, which would silently double its odds', () => {
    S().addEntry('Pizza');
    expect(S().addEntry('pizza')).toBe(false);
    expect(S().entries()).toEqual(['Pizza']);
  });

  it('refuses past the cap rather than accepting an unreadable wheel', () => {
    for (let i = 0; i < MAX_ENTRIES; i += 1) S().addEntry(`Entry ${i}`);
    expect(S().entries()).toHaveLength(MAX_ENTRIES);
    expect(S().addEntry('One more')).toBe(false);
  });

  it('removes by index', () => {
    S().addEntry('A');
    S().addEntry('B');
    S().removeEntry(0);
    expect(S().entries()).toEqual(['B']);
  });
});

describe('saved wheels', () => {
  const seedDraft = () => {
    S().addEntry('Pizza');
    S().addEntry('Sushi');
  };

  it('saves a wheel from the draft and makes it active', () => {
    seedDraft();
    const wheel = S().saveWheel('Dinner', false);
    expect(wheel).not.toBe('limit-reached');
    expect(S().wheels).toHaveLength(1);
    expect(S().activeWheel()?.name).toBe('Dinner');
  });

  it('refuses to save a wheel with fewer than two entries', () => {
    S().addEntry('Only one');
    expect(S().saveWheel('Nope', false)).toBe('limit-reached');
    expect(S().wheels).toEqual([]);
  });

  it('names an unnamed wheel after its first entry rather than leaving it blank', () => {
    seedDraft();
    S().saveWheel('  ', false);
    expect(S().wheels[0]!.name).toBe('Pizza');
  });

  it('caps a free user at the free limit', () => {
    for (let i = 0; i < FREE_WHEELS; i += 1) {
      useWheelStore.setState({ draftEntries: [`A${i}`, `B${i}`], activeId: null });
      expect(S().saveWheel(`Wheel ${i}`, false)).not.toBe('limit-reached');
    }
    useWheelStore.setState({ draftEntries: ['X', 'Y'], activeId: null });
    expect(S().saveWheel('One too many', false)).toBe('limit-reached');
    expect(S().wheels).toHaveLength(FREE_WHEELS);
  });

  it('lets a premium user past the limit', () => {
    for (let i = 0; i < FREE_WHEELS + 2; i += 1) {
      useWheelStore.setState({ draftEntries: [`A${i}`, `B${i}`], activeId: null });
      S().saveWheel(`Wheel ${i}`, true);
    }
    expect(S().wheels).toHaveLength(FREE_WHEELS + 2);
  });

  it('adds an entry to the ACTIVE wheel, not the draft', () => {
    seedDraft();
    S().saveWheel('Dinner', false);
    S().addEntry('Curry');
    expect(S().activeWheel()!.entries).toEqual(['Pizza', 'Sushi', 'Curry']);
    expect(S().draftEntries).toEqual(['Pizza', 'Sushi']);
  });

  it('gives a new entry a default weight of one', () => {
    seedDraft();
    S().saveWheel('Dinner', false);
    S().addEntry('Curry');
    expect(S().activeWheel()!.weights).toEqual([1, 1, 1]);
  });

  it('deletes a wheel and deselects it', () => {
    seedDraft();
    const wheel = S().saveWheel('Dinner', false);
    S().deleteWheel((wheel as { id: string }).id);
    expect(S().wheels).toEqual([]);
    expect(S().activeId).toBeNull();
  });

  it('ignores a selection for a wheel that does not exist', () => {
    S().selectWheel('nope');
    expect(S().activeId).toBeNull();
  });
});

describe('weights', () => {
  it('sets a weight on the active wheel', () => {
    S().addEntry('A');
    S().addEntry('B');
    S().saveWheel('W', false);
    S().setWeight(1, 3);
    expect(S().activeWheel()!.weights).toEqual([1, 3]);
  });

  it('refuses a weight that is not a positive number, rather than breaking the draw', () => {
    S().addEntry('A');
    S().addEntry('B');
    S().saveWheel('W', false);
    S().setWeight(0, -2);
    S().setWeight(1, Number.NaN);
    expect(S().activeWheel()!.weights).toEqual([1, 1]);
  });

  it('does nothing when no wheel is active', () => {
    S().setWeight(0, 5);
    expect(S().wheels).toEqual([]);
  });
});

describe('history and removal', () => {
  it('records a spin, newest first', () => {
    S().recordSpin('Pizza');
    S().recordSpin('Sushi');
    expect(S().history.map((h) => h.winner)).toEqual(['Sushi', 'Pizza']);
  });

  it('caps the history so a long-lived install cannot grow without bound', () => {
    for (let i = 0; i < 250; i += 1) S().recordSpin(`W${i}`);
    expect(S().history).toHaveLength(200);
  });

  it('clears the history', () => {
    S().recordSpin('Pizza');
    S().clearHistory();
    expect(S().history).toEqual([]);
  });

  it('removes the winner from the draft when drawing without replacement', () => {
    S().addEntry('A');
    S().addEntry('B');
    S().applyRemoval(0);
    expect(S().entries()).toEqual(['B']);
  });

  it('removes the winner from the active wheel too', () => {
    S().addEntry('A');
    S().addEntry('B');
    S().saveWheel('W', false);
    S().applyRemoval(1);
    expect(S().activeWheel()!.entries).toEqual(['A']);
    expect(S().activeWheel()!.weights).toHaveLength(1);
  });
});

describe('dice', () => {
  it('clamps an absurd die', () => {
    S().setDice(9999, 9999);
    expect([S().diceCount, S().diceSides]).toEqual([10, 100]);
  });

  it('refuses fewer than one die or fewer than two sides', () => {
    S().setDice(0, 1);
    expect([S().diceCount, S().diceSides]).toEqual([1, 2]);
  });
});

describe('persistence', () => {
  it('round-trips wheels, history and settings', async () => {
    S().addEntry('A');
    S().addEntry('B');
    S().saveWheel('Dinner', false);
    S().recordSpin('A');
    S().toggleRemoveOnWin();
    await S().persist();

    useWheelStore.setState(initial, true);
    await S().hydrate();

    expect(S().wheels).toHaveLength(1);
    expect(S().history).toHaveLength(1);
    expect(S().removeOnWin).toBe(true);
    expect(S().activeWheel()?.name).toBe('Dinner');
  });

  it('starts clean rather than throwing on corrupt state', async () => {
    await AsyncStorage.setItem(WHEEL_CACHE_KEY, '{{{');
    await S().hydrate();
    expect(S().wheels).toEqual([]);
  });

  it('drops a stored wheel of the wrong shape', async () => {
    await AsyncStorage.setItem(
      WHEEL_CACHE_KEY,
      JSON.stringify({ wheels: [{ id: 'x' }, { id: 'y', name: 'Ok', entries: ['A', 'B'], weights: [1, 1] }] }),
    );
    await S().hydrate();
    expect(S().wheels).toHaveLength(1);
  });

  it('forgets an active id whose wheel is gone', async () => {
    await AsyncStorage.setItem(WHEEL_CACHE_KEY, JSON.stringify({ wheels: [], activeId: 'ghost' }));
    await S().hydrate();
    expect(S().activeId).toBeNull();
  });

  it('repairs a stored wheel whose weights are shorter than its entries', async () => {
    await AsyncStorage.setItem(
      WHEEL_CACHE_KEY,
      JSON.stringify({ wheels: [{ id: 'y', name: 'W', entries: ['A', 'B', 'C'], weights: [2] }] }),
    );
    await S().hydrate();
    expect(S().wheels[0]!.weights).toEqual([2, 1, 1]);
  });
});
