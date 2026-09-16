import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BannerAdSlot } from '@/components/BannerAdSlot';
import { Wheel } from '@/components/Wheel';
import { Button, Card, Text } from '@/components/ui';
import { t } from '@/i18n';
import { drawIndex, landingAngle, rollDice, tossCoin, weightedIndex } from '@/logic/draw';
import { shouldShowInterstitial } from '@/monetization/adPolicy';
import { shouldShowAds } from '@/monetization/entitlements';
import { showInterstitial } from '@/monetization/interstitial';
import { FREE_WHEELS, useWheelStore, type Mode } from '@/store/useWheelStore';
import { usePremiumStore } from '@/store/usePremiumStore';
import { MIN_TOUCH_TARGET, useTheme, withAlpha } from '@/theme';

/** Whole turns before the wheel settles. Enough to read as a spin, not enough to be a wait. */
const TURNS = 5;

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, spacing, radius } = useTheme();

  const mode = useWheelStore((s) => s.mode);
  const setMode = useWheelStore((s) => s.setMode);
  const wheels = useWheelStore((s) => s.wheels);
  const activeId = useWheelStore((s) => s.activeId);
  const removeOnWin = useWheelStore((s) => s.removeOnWin);
  const history = useWheelStore((s) => s.history);
  const diceCount = useWheelStore((s) => s.diceCount);
  const diceSides = useWheelStore((s) => s.diceSides);
  const addEntry = useWheelStore((s) => s.addEntry);
  const removeEntry = useWheelStore((s) => s.removeEntry);
  const saveWheel = useWheelStore((s) => s.saveWheel);
  const selectWheel = useWheelStore((s) => s.selectWheel);
  const deleteWheel = useWheelStore((s) => s.deleteWheel);
  const recordSpin = useWheelStore((s) => s.recordSpin);
  const applyRemoval = useWheelStore((s) => s.applyRemoval);
  const toggleRemoveOnWin = useWheelStore((s) => s.toggleRemoveOnWin);
  const clearHistory = useWheelStore((s) => s.clearHistory);
  const hydrate = useWheelStore((s) => s.hydrate);

  const isPremium = usePremiumStore((s) => s.isPremium);
  const isReady = usePremiumStore((s) => s.isReady);

  const entries = useWheelStore((s) => s.entries)();
  const activeWheel = useWheelStore((s) => s.activeWheel)();

  const [draft, setDraft] = useState('');
  const [rejected, setRejected] = useState(false);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [coin, setCoin] = useState<'heads' | 'tails' | null>(null);
  const [dice, setDice] = useState<number[]>([]);

  const pendingWinner = useRef<number>(-1);
  const spins = useRef(0);
  const lastInterstitialAt = useRef(0);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!rejected) return;
    const timer = setTimeout(() => setRejected(false), 2200);
    return () => clearTimeout(timer);
  }, [rejected]);

  const canSpin = entries.length >= 2 && !spinning;

  const spin = () => {
    if (!canSpin) return;
    // The winner is drawn FIRST. The wheel is then animated to it. Spinning by a random angle
    // and reading off whatever stops under the pointer is biased by the segment geometry, and
    // the bias is invisible — the animation looks identical.
    const index = activeWheel && isPremium
      ? weightedIndex(activeWheel.weights)
      : drawIndex(entries.length);
    if (index < 0) return;
    pendingWinner.current = index;
    setWinner(null);
    setSpinning(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAngle((previous) => previous + landingAngle(index, entries.length, TURNS));
  };

  const settled = useCallback(() => {
    const index = pendingWinner.current;
    const name = entries[index];
    setSpinning(false);
    if (name === undefined) return;
    setWinner(name);
    recordSpin(name);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (removeOnWin) applyRemoval(index);
    spins.current += 1;
  }, [entries, recordSpin, removeOnWin, applyRemoval]);

  /**
   * The interstitial runs when the user moves to a different tool, never between a spin and
   * its result — the result is the entire reason for the tap.
   */
  // useCallback rather than a bare arrow: the React Compiler analyses an inline handler
  // created inside a .map() as render code, and rejects the Date.now() in it as an impure
  // call during render. Declaring it as a stable event handler is both the fix and the truth.
  const switchMode = useCallback((next: Mode) => {
    if (next === mode || spinning) return;
    if (
      shouldShowAds({ isPremium, isReady }) &&
      shouldShowInterstitial({
        gamesPlayed: spins.current,
        lastInterstitialAt: lastInterstitialAt.current,
        now: Date.now(),
        adsRemoved: isPremium,
      }) &&
      showInterstitial()
    ) {
      lastInterstitialAt.current = Date.now();
    }
    setWinner(null);
    setCoin(null);
    setDice([]);
    setMode(next);
  }, [mode, spinning, isPremium, isReady, setMode]);

  const submitEntry = () => {
    if (draft.trim() === '') return;
    if (!addEntry(draft)) {
      setRejected(true);
      return;
    }
    setDraft('');
  };

  const save = () => {
    const outcome = saveWheel(draft.trim() || t('savedWheels'), isPremium);
    if (outcome === 'limit-reached') {
      if (wheels.length >= FREE_WHEELS && !isPremium) {
        Alert.alert(t('wheelLimitTitle'), t('wheelLimitBody'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('removeAdsCta'), onPress: () => router.push('/paywall') },
        ]);
      } else {
        setRejected(true);
      }
      return;
    }
    setDraft('');
  };

  const wheelSize = Math.min(width - spacing.base * 2, 340);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + spacing.base,
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.xl,
          gap: spacing.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text variant="title" style={styles.grow}>
            {t('appName')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settingsTitle')}
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={styles.iconSlot}
          >
            <Feather name="settings" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={[styles.chips, { gap: spacing.sm }]}>
          {(['wheel', 'coin', 'dice'] as const).map((m) => {
            const selected = m === mode;
            const label = m === 'wheel' ? t('modeWheel') : m === 'coin' ? t('modeCoin') : t('modeDice');
            return (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                onPress={() => switchMode(m)}
                android_ripple={{ color: withAlpha(colors.accent, 0.16) }}
                style={{
                  minHeight: MIN_TOUCH_TARGET,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.base,
                  borderRadius: radius.full,
                  backgroundColor: selected ? colors.accent : colors.surfaceAlt,
                }}
              >
                <Text variant="callout" color={selected ? colors.onAccent : colors.text}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'wheel' ? (
          <>
            <View style={styles.centre}>
              {entries.length >= 2 ? (
                <Wheel entries={entries} angle={angle} spinning={spinning} onSettled={settled} size={wheelSize} />
              ) : (
                <Text variant="body" tone="muted" align="center" style={{ paddingVertical: spacing['3xl'] }}>
                  {t('needTwoEntries')}
                </Text>
              )}
            </View>

            {winner ? (
              <Card>
                <Text variant="micro" tone="faint">
                  {t('winnerIs').toUpperCase()}
                </Text>
                <Text variant="title" style={{ marginTop: spacing.xs }}>
                  {winner}
                </Text>
              </Card>
            ) : null}

            <Button label={t('spinButton')} size="lg" fullWidth disabled={!canSpin} onPress={spin} />

            {/* The field and the Add button beside it carry DIFFERENT labels on purpose: two
                controls announced identically are ambiguous to a screen reader. */}
            <View style={[styles.row, { gap: spacing.sm }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={submitEntry}
                placeholder={t('entryPlaceholder')}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel={t('entryPlaceholder')}
                returnKeyType="done"
                style={[
                  styles.input,
                  styles.grow,
                  { color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md },
                ]}
              />
              <Button label={t('addEntryLabel')} size="sm" disabled={draft.trim() === ''} onPress={submitEntry} />
            </View>

            {rejected ? (
              <Text variant="caption" tone="danger">
                {t('entryRejected')}
              </Text>
            ) : null}

            <View style={{ gap: spacing.xs }}>
              {entries.map((entry, index) => (
                <View
                  key={`${entry}-${index}`}
                  style={[
                    styles.entryRow,
                    { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.base, borderRadius: radius.md, backgroundColor: colors.surface },
                  ]}
                >
                  <Text variant="callout" style={styles.grow} numberOfLines={1}>
                    {entry}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t('deleteWheel')}: ${entry}`}
                    onPress={() => removeEntry(index)}
                    hitSlop={10}
                    style={styles.iconSlot}
                  >
                    <Feather name="x" size={16} color={colors.textFaint} />
                  </Pressable>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: removeOnWin }}
              accessibilityLabel={t('removeOnWinLabel')}
              onPress={toggleRemoveOnWin}
              style={[styles.row, { minHeight: MIN_TOUCH_TARGET, gap: spacing.md }]}
            >
              <Feather name={removeOnWin ? 'check-square' : 'square'} size={20} color={removeOnWin ? colors.accent : colors.textFaint} />
              <Text variant="callout" style={styles.grow}>
                {t('removeOnWinLabel')}
              </Text>
            </Pressable>

            <Button label={t('saveWheelLabel')} icon="bookmark" variant="secondary" size="sm" onPress={save} />

            {wheels.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="micro" tone="faint">
                  {t('savedWheels').toUpperCase()}
                </Text>
                {wheels.map((w) => (
                  <View
                    key={w.id}
                    style={[
                      styles.entryRow,
                      { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.base, borderRadius: radius.md, backgroundColor: w.id === activeId ? withAlpha(colors.accent, 0.16) : colors.surface },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: w.id === activeId }}
                      accessibilityLabel={w.name}
                      onPress={() => selectWheel(w.id)}
                      style={styles.grow}
                    >
                      <Text variant="callout" numberOfLines={1}>
                        {w.name}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t('deleteWheel')}: ${w.name}`}
                      onPress={() => deleteWheel(w.id)}
                      hitSlop={10}
                      style={styles.iconSlot}
                    >
                      <Feather name="trash-2" size={16} color={colors.textFaint} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <Text variant="caption" tone="faint">
              {t('fairnessNote')}
            </Text>
          </>
        ) : null}

        {mode === 'coin' ? (
          <View style={{ gap: spacing.base, alignItems: 'center' }}>
            <Text variant="display" style={{ paddingVertical: spacing['2xl'] }}>
              {coin === null ? '—' : coin === 'heads' ? t('headsLabel') : t('tailsLabel')}
            </Text>
            <Button
              label={t('tossButton')}
              size="lg"
              fullWidth
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setCoin(tossCoin());
                spins.current += 1;
              }}
            />
          </View>
        ) : null}

        {mode === 'dice' ? (
          <View style={{ gap: spacing.base }}>
            <Text variant="display" align="center" style={{ paddingVertical: spacing.xl }}>
              {dice.length === 0 ? '—' : dice.join('  ')}
            </Text>
            {dice.length > 0 ? (
              <Text variant="caption" tone="muted" align="center">
                {t('diceTotal', { total: dice.reduce((a, b) => a + b, 0) })}
              </Text>
            ) : null}
            <Button
              label={t('rollButton')}
              size="lg"
              fullWidth
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setDice(rollDice(diceCount, diceSides));
                spins.current += 1;
              }}
            />
          </View>
        ) : null}

        {history.length > 0 ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <View style={styles.row}>
              <Text variant="micro" tone="faint" style={styles.grow}>
                {t('historyTitle').toUpperCase()}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('clearHistory')} onPress={clearHistory} hitSlop={8}>
                <Text variant="caption" tone="accent">
                  {t('clearHistory')}
                </Text>
              </Pressable>
            </View>
            {history.slice(0, 8).map((record) => (
              <Text key={record.id} variant="caption" tone="muted" numberOfLines={1}>
                {record.winner}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  centre: { alignItems: 'center', justifyContent: 'center' },
  entryRow: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  input: { minHeight: MIN_TOUCH_TARGET, fontSize: 16 },
  iconSlot: { width: 36, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
});
