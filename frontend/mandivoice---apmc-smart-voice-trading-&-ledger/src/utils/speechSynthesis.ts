/**
 * Browser Speech Synthesis and Tactile Audio Feedback
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTactileChime(type: 'beep' | 'success' | 'record-start' | 'record-stop') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'record-start') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'record-stop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'success') {
      // Pleasant dual chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.15); // G5
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.2, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start(now);
      osc2.start(now + 0.15);
      osc.stop(now + 0.35);
      osc2.stop(now + 0.45);
    }
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export function speakMessage(text: string, lang: 'hi' | 'en' = 'hi'): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      playTactileChime('success');
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (lang === 'hi') {
        const hindiVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('HI'));
        if (hindiVoice) {
          utterance.voice = hindiVoice;
          utterance.lang = 'hi-IN';
        } else {
          utterance.lang = 'hi-IN';
        }
      } else {
        const enVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en-GB') || v.lang.includes('en'));
        if (enVoice) {
          utterance.voice = enVoice;
        }
        utterance.lang = 'en-IN';
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => {
        playTactileChime('success');
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      playTactileChime('success');
      resolve();
    }
  });
}

export function speakTradeSummary(trade: {
  seller_name?: string;
  raw_quantity: number | string;
  raw_unit: string;
  commodity: string;
  total_amount_inr: number | string;
}): Promise<void> {
  const seller = trade.seller_name && trade.seller_name !== 'Unknown' ? trade.seller_name : 'Kisan';
  const text = `${seller} ji, ${trade.raw_quantity} ${trade.raw_unit} ${trade.commodity}, kul ${trade.total_amount_inr} rupaye. Confirm karein?`;
  return speakMessage(text, 'hi');
}
