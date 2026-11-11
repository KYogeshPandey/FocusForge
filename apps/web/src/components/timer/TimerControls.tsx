import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '../ui/Button';

export interface TimerControlsProps {
  status: 'idle' | 'running' | 'paused';
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
}

export function TimerControls({
  status,
  onStart,
  onPause,
  onResume,
  onReset,
  onSkip,
}: TimerControlsProps) {
  const isRunning = status === 'running';

  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      {/* Reset Button */}
      <Button
        variant="secondary"
        size="icon"
        onClick={onReset}
        aria-label="Reset timer"
        title="Reset timer"
      >
        <RotateCcw className="w-5 h-5 text-text-muted hover:text-text" />
      </Button>

      {/* Main Start / Pause / Resume Button */}
      {isRunning ? (
        <Button
          size="lg"
          onClick={onPause}
          className="w-36 h-12 text-base font-semibold gap-2 shadow-md bg-warning hover:bg-warning/90 text-black"
          aria-label="Pause timer"
        >
          <Pause className="w-5 h-5 fill-current" />
          Pause
        </Button>
      ) : status === 'paused' ? (
        <Button
          size="lg"
          onClick={onResume}
          className="w-36 h-12 text-base font-semibold gap-2 shadow-md"
          aria-label="Resume timer"
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
          Resume
        </Button>
      ) : (
        <Button
          size="lg"
          onClick={onStart}
          className="w-36 h-12 text-base font-semibold gap-2 shadow-md"
          aria-label="Start timer"
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
          Start
        </Button>
      )}

      {/* Skip Button */}
      <Button
        variant="secondary"
        size="icon"
        onClick={onSkip}
        aria-label="Skip to next session"
        title="Skip session"
      >
        <SkipForward className="w-5 h-5 text-text-muted hover:text-text" />
      </Button>
    </div>
  );
}
