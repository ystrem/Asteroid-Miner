/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API Synthesizer for Retro Space Arcade SFX
// No external asset loading required, completely synthesized on-the-fly!

let audioCtx: AudioContext | null = null;
let isSoundEnabled = true;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function toggleSound(state?: boolean) {
  if (state !== undefined) {
    isSoundEnabled = state;
  } else {
    isSoundEnabled = !isSoundEnabled;
  }
  return isSoundEnabled;
}

export function getSoundState() {
  return isSoundEnabled;
}

export function playLaserSound(level: number) {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Laser characteristics by level
    if (level === 1) {
      // Simple sharp laser
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (level === 2) {
      // Thicker pulse
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + 0.2);

      osc.disconnect();
      osc.connect(filter);
      filter.connect(gainNode);

      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.21);
    } else if (level === 3) {
      // Rapid triple shot or complex sound (we can just play one fast, high-pitched double/triple sweep)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.11);

      // Play minor secondary delay for double feel
      setTimeout(() => {
        if (!isSoundEnabled) return;
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2);
        g2.connect(ctx.destination);
        o2.type = 'sawtooth';
        o2.frequency.setValueAtTime(1000, ctx.currentTime);
        o2.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.1);
        g2.gain.setValueAtTime(0.06, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        o2.start(ctx.currentTime);
        o2.stop(ctx.currentTime + 0.11);
      }, 50);
    } else {
      // Level 4 Heavy Piercing Beam
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.05); // quick charge-up feel
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.35);

      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.Q.setValueAtTime(10, now);
      filter.frequency.setValueAtTime(500, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.35);

      osc.disconnect();
      osc.connect(filter);
      filter.connect(gainNode);

      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  } catch (e) {
    console.warn("AudioContext playback blocked or failed:", e);
  }
}

export function playExplosionSound(size: string) {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // We can simulate an explosion using filtered custom noise
    const bufferSize = ctx.sampleRate * (size === 'huge' ? 0.8 : size === 'large' ? 0.5 : size === 'medium' ? 0.3 : 0.15);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';

    // Lower cutoff frequency for larger size explosions
    if (size === 'huge') {
      filter.frequency.setValueAtTime(120, now);
      filter.frequency.exponentialRampToValueAtTime(15, now + 0.8);
    } else if (size === 'large') {
      filter.frequency.setValueAtTime(250, now);
      filter.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    } else if (size === 'medium') {
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    } else {
      filter.frequency.setValueAtTime(700, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    }

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(size === 'huge' ? 0.4 : size === 'large' ? 0.3 : size === 'medium' ? 0.2 : 0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + (size === 'huge' ? 0.78 : size === 'large' ? 0.48 : size === 'medium' ? 0.28 : 0.13));

    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + (size === 'huge' ? 0.8 : size === 'large' ? 0.5 : size === 'medium' ? 0.3 : 0.15));

    // Also add a low-frequency synth bass thud for massive feels
    if (size === 'huge' || size === 'large') {
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(60, now);
      subOsc.frequency.linearRampToValueAtTime(20, now + 0.4);
      subGain.gain.setValueAtTime(0.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.45);
    }
  } catch (e) {
    console.warn("AudioContext explosion failed:", e);
  }
}

export function playCollectSound(type: string) {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';

    if (type === 'crystal') {
      // Basic pleasant high ping
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(2000, now + 0.12);
      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'diamond') {
      // Double rapid ascending crystal sound
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.setValueAtTime(1800, now + 0.05);
      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.setValueAtTime(0.08, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    } else {
      // Obsidian - deeper, vibrating structural metallic chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);

      // Add a higher-order resonance
      const osc2 = ctx.createOscillator();
      const gainNode2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(900, now);
      osc2.frequency.setValueAtTime(1350, now + 0.07);
      gainNode2.gain.setValueAtTime(0.06, now);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc2.connect(gainNode2);
      gainNode2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.23);
    }
  } catch (e) {
    console.warn("AudioContext collect sfx failed:", e);
  }
}

export function playUpgradeSound() {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Arpeggio of sweet notes
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const noteTime = now + (idx * 0.08);
      osc.frequency.setValueAtTime(freq, noteTime);
      gainNode.gain.setValueAtTime(0.12, noteTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

      osc.start(noteTime);
      osc.stop(noteTime + 0.26);
    });
  } catch (e) {
    console.warn("AudioContext upgrade sfx failed:", e);
  }
}

export function playDamageSound() {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    osc2.type = 'sawtooth';

    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    osc2.frequency.setValueAtTime(165, now); // slightly detuned for thickness
    osc2.frequency.exponentialRampToValueAtTime(43, now + 0.22);

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.23);
    osc2.stop(now + 0.23);
  } catch (e) {
    console.warn("AudioContext damage sfx failed:", e);
  }
}

export function playShieldDownSound() {
  if (!isSoundEnabled) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.4);

    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.41);
  } catch (e) {
    console.warn("AudioContext shield down sfx failed:", e);
  }
}
