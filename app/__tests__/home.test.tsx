import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import React from 'react';

import Home from '../index';
import { testRouter } from './testRouter';
import { renderWithProviders } from '@/components/__tests__/renderWithProviders';
import { t } from '@/i18n';
import { FREE_WHEELS, useWheelStore } from '@/store/useWheelStore';
import * as interstitial from '@/monetization/interstitial';
import { useAdsConsentStore } from '@/store/useAdsConsentStore';
import { usePremiumStore } from '@/store/usePremiumStore';

const wheelInitial = useWheelStore.getState();

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useWheelStore.setState(wheelInitial, true);
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({ consent: { canServeAds: true, offerPrivacyOptions: false } });
});

const addTwo = () => {
  useWheelStore.getState().addEntry('Pizza');
  useWheelStore.getState().addEntry('Sushi');
};

describe('the wheel', () => {
  it('asks for two options before it can spin', async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t('needTwoEntries'))).toBeTruthy();
  });

  it('adds an option from the field', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('entryPlaceholder')), 'Pizza');
    await fireEvent.press(getByText(t('addEntryLabel')));
    expect(useWheelStore.getState().entries()).toEqual(['Pizza']);
  });

  it('says why an option was rejected rather than appearing to accept it', async () => {
    useWheelStore.getState().addEntry('Pizza');
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.changeText(getByLabelText(t('entryPlaceholder')), 'pizza');
    await fireEvent.press(getByText(t('addEntryLabel')));
    await waitFor(() => expect(getByText(t('entryRejected'))).toBeTruthy());
    expect(useWheelStore.getState().entries()).toEqual(['Pizza']);
  });

  it('states plainly that every option is equally likely', async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t('fairnessNote'))).toBeTruthy();
  });

  it('removes an option', async () => {
    addTwo();
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(`${t('deleteWheel')}: Pizza`));
    expect(useWheelStore.getState().entries()).toEqual(['Sushi']);
  });

  it('records a winner that is one of the entries', async () => {
    addTwo();
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('spinButton')));
    // The reanimated mock runs the animation callback synchronously.
    await waitFor(() => expect(useWheelStore.getState().history.length).toBeGreaterThan(0));
    expect(['Pizza', 'Sushi']).toContain(useWheelStore.getState().history[0]!.winner);
  });

  it('removes the winner when drawing without replacement', async () => {
    addTwo();
    useWheelStore.getState().toggleRemoveOnWin();
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('spinButton')));
    await waitFor(() => expect(useWheelStore.getState().entries()).toHaveLength(1));
  });

  it('toggles remove-on-win', async () => {
    addTwo();
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('removeOnWinLabel')));
    expect(useWheelStore.getState().removeOnWin).toBe(true);
  });
});

describe('saved wheels', () => {
  it('saves the current wheel', async () => {
    addTwo();
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('saveWheelLabel')));
    expect(useWheelStore.getState().wheels).toHaveLength(1);
  });

  it('offers the upgrade at the free limit instead of silently failing', async () => {
    for (let i = 0; i < FREE_WHEELS; i += 1) {
      useWheelStore.setState({ draftEntries: [`A${i}`, `B${i}`], activeId: null });
      useWheelStore.getState().saveWheel(`W${i}`, false);
    }
    useWheelStore.setState({ draftEntries: ['X', 'Y'], activeId: null });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('saveWheelLabel')));
    expect(alert).toHaveBeenCalledWith(t('wheelLimitTitle'), t('wheelLimitBody'), expect.any(Array));
    expect(useWheelStore.getState().wheels).toHaveLength(FREE_WHEELS);
  });

  it('lets a premium user save past the limit', async () => {
    for (let i = 0; i < FREE_WHEELS; i += 1) {
      useWheelStore.setState({ draftEntries: [`A${i}`, `B${i}`], activeId: null });
      useWheelStore.getState().saveWheel(`W${i}`, true);
    }
    usePremiumStore.setState({ isPremium: true });
    useWheelStore.setState({ draftEntries: ['X', 'Y'], activeId: null });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('saveWheelLabel')));
    expect(alert).not.toHaveBeenCalled();
    expect(useWheelStore.getState().wheels).toHaveLength(FREE_WHEELS + 1);
  });

  it('selects and deletes a saved wheel', async () => {
    addTwo();
    const wheel = useWheelStore.getState().saveWheel('Dinner', false) as { id: string };
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText('Dinner'));
    expect(useWheelStore.getState().activeId).toBe(wheel.id);
    await fireEvent.press(getByLabelText(`${t('deleteWheel')}: Dinner`));
    expect(useWheelStore.getState().wheels).toEqual([]);
  });
});

describe('coin and dice', () => {
  it('tosses a coin and shows one of two faces', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('modeCoin')));
    await fireEvent.press(getByText(t('tossButton')));
    await waitFor(() => {
      const heads = getByText(new RegExp(`${t('headsLabel')}|${t('tailsLabel')}`));
      expect(heads).toBeTruthy();
    });
  });

  it('rolls dice and totals them', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('modeDice')));
    await fireEvent.press(getByText(t('rollButton')));
    await waitFor(() => expect(getByText(new RegExp(t('diceTotal', { total: '.*' })))).toBeTruthy());
  });
});

describe('ads', () => {
  it('shows a banner to a free user', async () => {
    const { queryByTestId } = await renderWithProviders(<Home />);
    expect(queryByTestId('banner-ad')).not.toBeNull();
  });

  it('shows no banner to a premium user', async () => {
    usePremiumStore.setState({ isPremium: true });
    const { queryByTestId } = await renderWithProviders(<Home />);
    expect(queryByTestId('banner-ad')).toBeNull();
  });

  it('never interrupts between a spin and its result', async () => {
    addTwo();
    const spy = jest.spyOn(interstitial, 'showInterstitial').mockReturnValue(true);
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t('spinButton')));
    expect(spy).not.toHaveBeenCalled();
  });

  it('runs an interstitial when moving to another tool, once enough spins have happened', async () => {
    addTwo();
    const spy = jest.spyOn(interstitial, 'showInterstitial').mockReturnValue(true);
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    for (let i = 0; i < 3; i += 1) await fireEvent.press(getByText(t('spinButton')));
    await fireEvent.press(getByLabelText(t('modeCoin')));
    expect(spy).toHaveBeenCalled();
  });

  it('never interrupts a premium user', async () => {
    addTwo();
    usePremiumStore.setState({ isPremium: true });
    const spy = jest.spyOn(interstitial, 'showInterstitial').mockReturnValue(true);
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    for (let i = 0; i < 6; i += 1) await fireEvent.press(getByText(t('spinButton')));
    await fireEvent.press(getByLabelText(t('modeCoin')));
    expect(spy).not.toHaveBeenCalled();
  });

  it('opens settings', async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByLabelText(t('settingsTitle')));
    expect(testRouter.push).toHaveBeenCalledWith('/settings');
  });
});
