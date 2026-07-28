// Short two-tone chime synthesized via Web Audio API — avoids shipping a
// binary audio asset just for a notification ping.
let audioCtx: AudioContext | null = null;

export function playNotificationSound() {
  try {
    audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const notes: [frequency: number, start: number][] = [
      [880, 0],
      [1108.73, 0.1],
    ];

    notes.forEach(([frequency, start]) => {
      const oscillator = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.3);

      oscillator.connect(gain);
      gain.connect(audioCtx!.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + 0.3);
    });
  } catch {
    // Audio is a nice-to-have; ignore failures (e.g. autoplay policy before
    // any user gesture has occurred on the page).
  }
}
