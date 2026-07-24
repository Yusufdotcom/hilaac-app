/** Unlock audio after a user gesture (required by many browsers). */
let audioUnlocked = false;

export function unlockOrderSounds() {
  audioUnlocked = true;
}

function playSynthChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.12;
      osc.start(start);
      osc.stop(start + 0.25);
    });
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    // Ignore blocked audio.
  }
}

function playSynthReady() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    [440, 554.37].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.value = 0.09;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.18;
      osc.start(start);
      osc.stop(start + 0.35);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Ignore blocked audio.
  }
}

async function playSoundFile(path: string, fallback: () => void) {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio(path);
    audio.volume = 0.55;
    audio.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      audio.oncanplaythrough = () => resolve();
      audio.onerror = () => reject(new Error("load failed"));
      audio.load();
    });

    await audio.play();
  } catch {
    fallback();
  }
}

/** Gentle chime for customers when order is ready. */
export function playCustomerReadyChime() {
  if (!audioUnlocked && typeof window !== "undefined") {
    unlockOrderSounds();
  }
  void playSoundFile("/sounds/chime.mp3", playSynthChime);
}

/** Distinct alert for waiter dashboard when an order becomes ready. */
export function playWaiterReadySound() {
  void playSoundFile("/sounds/ready.mp3", playSynthReady);
}
