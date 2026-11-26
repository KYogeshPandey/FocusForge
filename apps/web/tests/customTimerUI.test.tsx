import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import FocusTimerPage from '../src/pages/FocusTimerPage';
import SettingsPage from '../src/pages/SettingsPage';
import { useTimerStore } from '../src/stores/useTimerStore';
import {
  FOCUS_DURATION_PRESETS,
  BREAK_DURATION_PRESETS,
  LONG_BREAK_DURATION_PRESETS,
} from '../src/utils/timer';
import { getSettingsService } from '../src/services/serviceFactory';

function renderWithProviders(ui: React.ReactElement, queryClient?: QueryClient) {
  const client =
    queryClient ||
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Customizable Focus Timer UI & Settings Synchronization', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    const store = useTimerStore.getState();
    await store.setLinkedTask(null, null);
    await store.resetDefaults();
    await store.setMode('focus');
    await store.reset();
  });

  it('displays 25/5/15 defaults, fixed 5-round cycle without interval input, and all presets', () => {
    renderWithProviders(<FocusTimerPage />);

    expect(
      screen.getByText('Selected: 25m focus · 5m short break · 15m long break (every 5 rounds)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Focus 25m · Short 5m · Long 15m · Long break every 5 rounds')
    ).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(
      screen.getAllByText((_, el) => el?.textContent === 'Round 1 of 5').length
    ).toBeGreaterThan(0);

    // Long break interval must remain fixed at 5 (no customization input)
    expect(screen.queryByLabelText(/Long break interval/i)).not.toBeInTheDocument();

    const focusGroup = screen.getByRole('group', { name: 'Focus duration presets' });
    for (const preset of FOCUS_DURATION_PRESETS) {
      expect(within(focusGroup).getByRole('button', { name: `${preset}m` })).toBeInTheDocument();
    }

    const breakGroup = screen.getByRole('group', { name: 'Break duration presets' });
    for (const preset of BREAK_DURATION_PRESETS) {
      expect(within(breakGroup).getByRole('button', { name: `${preset}m` })).toBeInTheDocument();
    }

    const longBreakGroup = screen.getByRole('group', { name: 'Long break duration presets' });
    for (const preset of LONG_BREAK_DURATION_PRESETS) {
      expect(within(longBreakGroup).getByRole('button', { name: `${preset}m` })).toBeInTheDocument();
    }
  });

  it('updates focus, short break, and long break durations via presets/inputs and resets defaults including interval 5', async () => {
    renderWithProviders(<FocusTimerPage />);

    // Click 60m focus preset
    fireEvent.click(screen.getByRole('button', { name: '60m' }));
    await waitFor(() => {
      expect(screen.getByText('60:00')).toBeInTheDocument();
    });

    // Enter custom focus duration (50m)
    fireEvent.change(screen.getByLabelText('Custom focus minutes'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Focus' }));
    await waitFor(() => {
      expect(screen.getByText('50:00')).toBeInTheDocument();
    });

    // Enter custom short break duration (12m)
    fireEvent.change(screen.getByLabelText('Custom break minutes'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Break' }));
    await waitFor(() => {
      expect(
        screen.getByText('Selected: 50m focus · 12m short break · 15m long break (every 5 rounds)')
      ).toBeInTheDocument();
    });

    // Enter custom long break duration (30m)
    fireEvent.change(screen.getByLabelText('Custom long break minutes'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Long Break' }));
    await waitFor(() => {
      expect(
        screen.getByText('Selected: 50m focus · 12m short break · 30m long break (every 5 rounds)')
      ).toBeInTheDocument();
    });

    // Reset all defaults (25 / 5 / 15 / 5)
    fireEvent.click(screen.getByRole('button', { name: /Reset durations to default/i }));
    await waitFor(() => {
      expect(
        screen.getByText('Selected: 25m focus · 5m short break · 15m long break (every 5 rounds)')
      ).toBeInTheDocument();
      expect(screen.getByText('25:00')).toBeInTheDocument();
    });

    const saved = await getSettingsService().get();
    expect(saved.focusDuration).toBe(25);
    expect(saved.shortBreakDuration).toBe(5);
    expect(saved.longBreakDuration).toBe(15);
    expect(saved.longBreakInterval).toBe(5);
  });

  it('validates custom inputs across focus (1-180), short break (1-60), and long break (1-90)', async () => {
    renderWithProviders(<FocusTimerPage />);

    fireEvent.change(screen.getByLabelText('Custom focus minutes'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Focus' }));

    fireEvent.change(screen.getByLabelText('Custom break minutes'), { target: { value: '61' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Break' }));

    fireEvent.change(screen.getByLabelText('Custom long break minutes'), { target: { value: '91' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Long Break' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((el) => el.textContent?.includes('between 1 and 180 minutes'))).toBe(true);
    expect(alerts.some((el) => el.textContent?.includes('between 1 and 60 minutes'))).toBe(true);
    expect(alerts.some((el) => el.textContent?.includes('between 1 and 90 minutes'))).toBe(true);

    const state = useTimerStore.getState();
    expect(state.focusDuration).toBe(25);
    expect(state.shortBreakDuration).toBe(5);
    expect(state.longBreakDuration).toBe(15);
    expect(state.longBreakInterval).toBe(5);
  });

  it('handles settings save and reset errors gracefully without crashing', async () => {
    renderWithProviders(<FocusTimerPage />);

    const focusGroup = screen.getByRole('group', { name: 'Focus duration presets' });
    fireEvent.click(within(focusGroup).getByRole('button', { name: '45m' }));
    await waitFor(() => {
      expect(useTimerStore.getState().focusDuration).toBe(45);
    });

    vi.spyOn(getSettingsService(), 'update').mockRejectedValueOnce(new Error('Network unavailable'));
    fireEvent.click(screen.getByRole('button', { name: /Reset durations to default/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    expect(useTimerStore.getState().focusDuration).toBe(45);
  });

  it('resets all draft inputs on Reset Defaults even when short break was unchanged, and preserves drafts on failure', async () => {
    renderWithProviders(<FocusTimerPage />);

    // Set only focusDuration to 45m while shortBreakDuration (5m) and longBreakDuration (15m) remain at defaults
    const focusGroup = screen.getByRole('group', { name: 'Focus duration presets' });
    fireEvent.click(within(focusGroup).getByRole('button', { name: '45m' }));
    await waitFor(() => {
      expect(useTimerStore.getState().focusDuration).toBe(45);
    });

    const focusInput = screen.getByLabelText('Custom focus minutes') as HTMLInputElement;
    const breakInput = screen.getByLabelText('Custom break minutes') as HTMLInputElement;
    const longBreakInput = screen.getByLabelText('Custom long break minutes') as HTMLInputElement;

    // Enter unsaved drafts across all inputs, including unchanged-default short break (5 -> 9)
    fireEvent.change(focusInput, { target: { value: '70' } });
    fireEvent.change(breakInput, { target: { value: '9' } });
    fireEvent.change(longBreakInput, { target: { value: '22' } });

    // If reset fails, unsaved drafts must be preserved
    vi.spyOn(getSettingsService(), 'update').mockRejectedValueOnce(new Error('Reset failed'));
    fireEvent.click(screen.getByRole('button', { name: /Reset durations to default/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Reset failed');
    expect(focusInput.value).toBe('70');
    expect(breakInput.value).toBe('9');
    expect(longBreakInput.value).toBe('22');

    // When reset succeeds, all three draft inputs reset to defaults (25 / 5 / 15)
    fireEvent.click(screen.getByRole('button', { name: /Reset durations to default/i }));
    await waitFor(() => {
      expect(useTimerStore.getState().focusDuration).toBe(25);
      expect(focusInput.value).toBe('25');
      expect(breakInput.value).toBe('5');
      expect(longBreakInput.value).toBe('15');
    });
  });

  it('preserves running countdown when settings change and indicates changes apply next session', async () => {
    renderWithProviders(<FocusTimerPage />);

    await act(async () => {
      await useTimerStore.getState().start();
    });
    expect(
      screen.getByText(/Active timer unchanged · applies next session/i)
    ).toBeInTheDocument();

    const focusGroup = screen.getByRole('group', { name: 'Focus duration presets' });
    fireEvent.click(within(focusGroup).getByRole('button', { name: '45m' }));

    await waitFor(() => {
      expect(useTimerStore.getState().focusDuration).toBe(45);
    });
    expect(useTimerStore.getState().totalDurationSeconds).toBe(25 * 60);
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('keeps SettingsPage and FocusTimerPage synchronized bidirectionally', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // 1. Update durations on FocusTimerPage -> SettingsPage displays the updated values
    const timerRender = renderWithProviders(<FocusTimerPage />, queryClient);
    const focusGroup = screen.getByRole('group', { name: 'Focus duration presets' });
    fireEvent.click(within(focusGroup).getByRole('button', { name: '45m' }));
    await waitFor(() => {
      expect(useTimerStore.getState().focusDuration).toBe(45);
    });
    timerRender.unmount();

    const settingsRender = renderWithProviders(<SettingsPage />, queryClient);
    // SettingsPage has fixed interval note and no Rounds for Long Break input
    expect(screen.queryByLabelText(/Rounds for Long Break/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Long break triggers automatically after every 5 completed focus rounds/i)
    ).toBeInTheDocument();

    const focusSettingsInput = await screen.findByLabelText('Focus Duration');
    await waitFor(() => {
      expect((focusSettingsInput as HTMLInputElement).value).toBe('45');
    });

    // 2. Update durations on SettingsPage -> FocusTimerPage immediately reflects new idle duration
    fireEvent.change(focusSettingsInput, { target: { value: '35' } });
    fireEvent.change(screen.getByLabelText('Short Break'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Long Break'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/i }));

    await waitFor(() => {
      expect(useTimerStore.getState().focusDuration).toBe(35);
      expect(useTimerStore.getState().shortBreakDuration).toBe(8);
      expect(useTimerStore.getState().longBreakDuration).toBe(20);
      expect(useTimerStore.getState().longBreakInterval).toBe(5);
    });

    settingsRender.unmount();
    renderWithProviders(<FocusTimerPage />, queryClient);
    expect(screen.getByText('35:00')).toBeInTheDocument();
    expect(
      screen.getByText('Selected: 35m focus · 8m short break · 20m long break (every 5 rounds)')
    ).toBeInTheDocument();
  });
});
