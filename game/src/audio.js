// All sound is synthesized with WebAudio — no audio files, no network.
// A lazy AudioContext starts on the first user gesture; every call is
// guarded so a silent or blocked context never breaks the game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* sound is decoration; never fail the game */ }
  }

  function noise(dur, vol, lowpass) {
    if (muted || !ensure()) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.2;
      if (lowpass) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpass;
        source.connect(filter);
        filter.connect(gain);
      } else {
        source.connect(gain);
      }
      gain.connect(master);
      source.start();
    } catch { /* ignore */ }
  }

  return {
    unlock() { ensure(); },
    setMuted(value) {
      muted = value;
      if (muted) this.sirenStop();
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },

    gunshot() { noise(0.14, 0.3, 2400); tone(160, 0.08, 'square', 0.1, 60); },
    punch() { noise(0.07, 0.18, 900); },
    crash() { noise(0.25, 0.3, 700); tone(90, 0.2, 'sawtooth', 0.12, 40); },
    pickup() { tone(660, 0.09, 'sine', 0.16); setTimeout(() => tone(990, 0.12, 'sine', 0.16), 90); },
    cash() { tone(880, 0.08, 'sine', 0.14); setTimeout(() => tone(1320, 0.14, 'sine', 0.14), 80); },
    horn() { tone(330, 0.18, 'square', 0.08); tone(415, 0.18, 'square', 0.06); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.16), i * 110));
    },
    busted() { tone(220, 0.5, 'sawtooth', 0.14, 110); },
    click() { tone(440, 0.05, 'sine', 0.1); },

    engineStart() {
      if (muted || !ensure() || engineOsc) return;
      try {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 70;
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      } catch { engineOsc = null; }
    },
    engineSet(ratio, on) {
      if (!engineOsc || !engineGain) return;
      try {
        engineOsc.frequency.setTargetAtTime(55 + ratio * 165, ctx.currentTime, 0.06);
        engineGain.gain.setTargetAtTime(on ? 0.05 + ratio * 0.05 : 0.0, ctx.currentTime, 0.08);
      } catch { /* ignore */ }
    },
    engineStop() {
      if (engineOsc) {
        try { engineOsc.stop(); } catch { /* ignore */ }
        engineOsc = null;
        engineGain = null;
      }
    },

    sirenStart() {
      if (muted || !ensure() || sirenOsc) return;
      try {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 700;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        sirenHigh = true;
        sirenTimer = window.setInterval(() => {
          if (!sirenOsc) return;
          sirenHigh = !sirenHigh;
          try { sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 650, ctx.currentTime, 0.05); } catch { /* ignore */ }
        }, 420);
      } catch { sirenOsc = null; }
    },
    sirenStop() {
      if (sirenTimer) { window.clearInterval(sirenTimer); sirenTimer = 0; }
      if (sirenOsc) {
        try { sirenOsc.stop(); } catch { /* ignore */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
  };
}
