// Strict Language Personalization TTS Engine for APMC MandiVoice
export function speakTradeSummary(trade, lang = 'hi') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    // 1. Stop any ongoing speech before playing new audio
    window.speechSynthesis.cancel();

    if (!trade) return;

    const seller = trade.seller || trade.seller_name;
    const raw_quantity = trade.raw_quantity ?? '';
    const raw_unit = trade.raw_unit ?? '';
    const commodity = trade.commodity ?? '';
    const total_amount_inr = trade.total_amount_inr ?? '';

    const langLower = (lang || 'hi').toLowerCase();
    let text = '';
    let targetLang = 'hi-IN';
    let langCode = 'hi';

    if (langLower === 'te' || langLower === 'telugu') {
      const s = seller || 'రైతు';
      text = `${s} గారు, ${raw_quantity} ${raw_unit} ${commodity}, మొత్తం ${total_amount_inr} రూపాయలు. ఖరారు చేయాలా?`;
      targetLang = 'te-IN';
      langCode = 'te';
    } else if (langLower === 'mr' || langLower === 'marathi') {
      const s = seller || 'शेतकरी';
      text = `${s} जी, ${raw_quantity} ${raw_unit} ${commodity}, एकूण ${total_amount_inr} रुपये. नक्की करायचे का?`;
      targetLang = 'mr-IN';
      langCode = 'mr';
    } else if (langLower === 'en' || langLower === 'english') {
      const s = seller || 'Farmer';
      text = `${s}, ${raw_quantity} ${raw_unit} of ${commodity}, total ₹${total_amount_inr}. Confirm this trade?`;
      targetLang = 'en-IN';
      langCode = 'en';
    } else {
      // hi / hinglish / default
      const s = seller || 'किसान';
      text = `${s} जी, ${raw_quantity} ${raw_unit} ${commodity}, कुल ${total_amount_inr} रुपये. कन्फर्म करें?`;
      targetLang = 'hi-IN';
      langCode = 'hi';
    }

    const playUtterance = (voices) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.lang = targetLang;

      // Strictly query installed voices matching language code
      if (Array.isArray(voices) && voices.length > 0) {
        const exactMatch = voices.find(
          (v) => v.lang && v.lang.toLowerCase() === targetLang.toLowerCase()
        );
        const prefixMatch = voices.find(
          (v) => v.lang && v.lang.toLowerCase().startsWith(langCode)
        );
        const indianEnglishMatch = (langCode === 'en')
          ? voices.find((v) => v.lang && v.lang.toLowerCase().includes('en-in'))
          : null;

        const bestVoice = exactMatch || prefixMatch || indianEnglishMatch;
        if (bestVoice) {
          utterance.voice = bestVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
    };

    const currentVoices = window.speechSynthesis.getVoices();
    if (currentVoices && currentVoices.length > 0) {
      playUtterance(currentVoices);
    } else {
      let fired = false;
      window.speechSynthesis.onvoiceschanged = () => {
        if (!fired) {
          fired = true;
          const updatedVoices = window.speechSynthesis.getVoices();
          playUtterance(updatedVoices);
        }
      };
      setTimeout(() => {
        if (!fired && !window.speechSynthesis.speaking) {
          fired = true;
          playUtterance(window.speechSynthesis.getVoices());
        }
      }, 150);
    }
  } catch (err) {
    console.error('TTS playback error:', err);
  }
}

export default speakTradeSummary;
