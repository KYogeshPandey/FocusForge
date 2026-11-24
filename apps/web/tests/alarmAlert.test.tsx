import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AlarmAlert } from '../src/components/timer/AlarmAlert';
import { TimerControls } from '../src/components/timer/TimerControls';
import { useTimerStore } from '../src/stores/useTimerStore';

describe('AlarmAlert Component and Controls Integration', () => {
  beforeEach(() => {
    useTimerStore.setState({
      isAlarmActive: false,
      alarmPeriodName: null,
    });
  });

  it('renders nothing when isAlarmActive is false', () => {
    const { container } = render(
      <MemoryRouter>
        <AlarmAlert variant="page" />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders page variant with Time\'s up! and completed period name when isAlarmActive is true', () => {
    useTimerStore.setState({
      isAlarmActive: true,
      alarmPeriodName: 'Physics Study (Focus Session)',
    });

    render(
      <MemoryRouter>
        <AlarmAlert variant="page" />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText("Time's up!")).toBeInTheDocument();
    expect(screen.getByText('Physics Study (Focus Session)')).toBeInTheDocument();

    const pauseButton = screen.getByRole('button', { name: /pause alarm/i });
    expect(pauseButton).toBeInTheDocument();

    // Clicking pause alarm stops the alarm
    fireEvent.click(pauseButton);
    expect(useTimerStore.getState().isAlarmActive).toBe(false);
  });

  it('renders banner variant in top layout when isAlarmActive is true', () => {
    useTimerStore.setState({
      isAlarmActive: true,
      alarmPeriodName: 'Short Break',
    });

    render(
      <MemoryRouter>
        <AlarmAlert variant="banner" />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Short Break completed/i)).toBeInTheDocument();

    const pauseButton = screen.getByRole('button', { name: /pause alarm/i });
    expect(pauseButton).toBeInTheDocument();

    fireEvent.click(pauseButton);
    expect(useTimerStore.getState().isAlarmActive).toBe(false);
  });

  it('TimerControls renders prominent Pause Alarm button when isAlarmActive is true', () => {
    let paused = false;

    render(
      <TimerControls
        status="idle"
        isAlarmActive={true}
        onStart={() => {}}
        onPause={() => {}}
        onResume={() => {}}
        onReset={() => {}}
        onSkip={() => {}}
        onPauseAlarm={() => {
          paused = true;
        }}
      />
    );

    const pauseAlarmBtn = screen.getByRole('button', { name: /pause alarm/i });
    expect(pauseAlarmBtn).toBeInTheDocument();

    fireEvent.click(pauseAlarmBtn);
    expect(paused).toBe(true);
  });
});
