/**
 * Plays a pleasant synthesizer chime using Web Audio API
 * Safe fallback that requires no external audio assets or network requests
 */
export function playChime(volumePercent: number = 70): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const gainNode = ctx.createGain();
    const masterVolume = Math.max(0, Math.min(1, volumePercent / 100)) * 0.3; // safe max gain

    gainNode.gain.setValueAtTime(masterVolume, ctx.currentTime);
    gainNode.connect(ctx.destination);

    // Warm chord: C5, E5, G5, B5 arpeggio
    const frequencies = [523.25, 659.25, 783.99, 987.77];

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const startTime = ctx.currentTime + idx * 0.08;
      const duration = 0.8;

      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(1, startTime + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(noteGain);
      noteGain.connect(gainNode);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch (err) {
    console.warn('Audio playback not supported or blocked by user gesture policy', err);
  }
}
