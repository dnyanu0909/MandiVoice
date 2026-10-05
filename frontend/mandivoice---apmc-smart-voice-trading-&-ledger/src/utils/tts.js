// Strict Regional Audio TTS Synthesis Engine for APMC MandiVoice
// Robust loading with speech synthesis voice detection, Indic fallbacks, and localized templates

function getAvailableVoices() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      resolve(voices);
      return;
    }

    let resolved = false;
    const handleVoicesChanged = () => {
      if (!resolved) {
        resolved = true;
        resolve(window.speechSynthesis.getVoices() || []);
      }
    };

    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;

    // Safety fallback timeout if onvoiceschanged doesn't fire immediately
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(window.speechSynthesis.getVoices() || []);
      }
    }, 250);
  });
}

export async function speakTradeSummary(trade, lang = 'hi') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    // 1. Cancel any active or pending speech synthesis
    window.speechSynthesis.cancel();

    if (!trade) return;

    const seller = trade.seller_name || trade.seller;
    const raw_quantity = trade.raw_quantity ?? '';
    const raw_unit = trade.raw_unit ?? '';
    const commodity = trade.commodity ?? '';
    const total_amount_inr = trade.total_amount_inr != null ? trade.total_amount_inr : '';

    const langLower = (lang || 'hi').toLowerCase();
    let text = '';
    let targetLang = 'hi-IN';
    let langCode = 'hi';

    // 2. Localized dialect text templates
    if (langLower === 'te' || langLower === 'telugu') {
      const s = seller || 'రైతు';
      text = `${s} గారు, ${raw_quantity} ${raw_unit} ${commodity}, మొత్తం ₹${total_amount_inr} రూపాయలు. ఖరారు చేయాలా?`;
      targetLang = 'te-IN';
      langCode = 'te';
    } else if (langLower === 'mr' || langLower === 'marathi') {
      const s = seller || 'शेतकरी';
      text = `${s} जी, ${raw_quantity} ${raw_unit} ${commodity}, एकूण ₹${total_amount_inr} रुपये. नक्की करायचे का?`;
      targetLang = 'mr-IN';
      langCode = 'mr';
    } else if (langLower === 'en' || langLower === 'english') {
      const s = seller || 'Farmer';
      text = `${s}, ${raw_quantity} ${raw_unit} of ${commodity}, total ₹${total_amount_inr}. Confirm this trade?`;
      targetLang = 'en-IN';
      langCode = 'en';
    } else {
      // Default: Hindi / Hinglish
      const s = seller || 'किसान';
      text = `${s} जी, ${raw_quantity} ${raw_unit} ${commodity}, कुल ₹${total_amount_inr} रुपये. कन्फर्म करें?`;
      targetLang = 'hi-IN';
      langCode = 'hi';
    }

    const voices = await getAvailableVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Clear regional cadence
    utterance.pitch = 1.0;
    utterance.lang = targetLang;

    let selectedVoice = null;

    if (Array.isArray(voices) && voices.length > 0) {
      if (langCode === 'te') {
        // Native Telugu voice lookup
        selectedVoice = voices.find(
          (v) => (v.lang && (v.lang.toLowerCase() === 'te-in' || v.lang.toLowerCase().startsWith('te'))) ||
                 (v.name && v.name.toLowerCase().includes('telugu'))
        );

        // Fallback pipeline: if no native Telugu voice is installed, fallback cleanly to Indic voice (hi-IN or en-IN)
        if (!selectedVoice) {
          selectedVoice = voices.find(
            (v) => (v.lang && (v.lang.toLowerCase() === 'hi-in' || v.lang.toLowerCase().startsWith('hi'))) ||
                   (v.name && v.name.toLowerCase().includes('hindi'))
          ) || voices.find(
            (v) => (v.lang && v.lang.toLowerCase().includes('en-in')) ||
                   (v.name && v.name.toLowerCase().includes('india'))
          );
          if (selectedVoice) {
            utterance.lang = selectedVoice.lang || 'hi-IN';
          }
        }
      } else if (langCode === 'mr') {
        // Native Marathi voice lookup
        selectedVoice = voices.find(
          (v) => (v.lang && (v.lang.toLowerCase() === 'mr-in' || v.lang.toLowerCase().startsWith('mr'))) ||
                 (v.name && v.name.toLowerCase().includes('marathi'))
        );

        // Fallback pipeline: Marathi shares Devanagari script phonetics with Hindi
        if (!selectedVoice) {
          selectedVoice = voices.find(
            (v) => (v.lang && (v.lang.toLowerCase() === 'hi-in' || v.lang.toLowerCase().startsWith('hi'))) ||
                   (v.name && v.name.toLowerCase().includes('hindi'))
          );
          if (selectedVoice) {
            utterance.lang = 'hi-IN';
          }
        }
      } else if (langCode === 'en') {
        selectedVoice = voices.find((v) => v.lang && v.lang.toLowerCase().includes('en-in')) ||
                        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
      } else {
        // Hindi voice lookup
        selectedVoice = voices.find(
          (v) => (v.lang && (v.lang.toLowerCase() === 'hi-in' || v.lang.toLowerCase().startsWith('hi'))) ||
                 (v.name && v.name.toLowerCase().includes('hindi'))
        );
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    // 3. Log matched voice for debugging
    console.log(
      `[MandiVoice TTS] Language: ${langCode} (${utterance.lang}), Voice: ${
        utterance.voice ? `${utterance.voice.name} (${utterance.voice.lang})` : 'System Default'
      }`
    );

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('[MandiVoice TTS] Playback error:', err);
  }
}

export default speakTradeSummary;
