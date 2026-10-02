export function speakTradeSummary(trade, lang = 'hi') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const seller = trade.seller || trade.seller_name || 'Kisan';
    const raw_quantity = trade.raw_quantity ?? '';
    const raw_unit = trade.raw_unit ?? '';
    const commodity = trade.commodity ?? '';
    const total_amount_inr = trade.total_amount_inr ?? '';

    let text = '';
    let targetLang = 'hi-IN';
    let langPrefix = 'hi';

    switch (lang) {
      case 'te':
        text = `${seller} garu, ${raw_quantity} ${raw_unit} ${commodity}, motham ${total_amount_inr} rupayalu. Confirm cheyala?`;
        targetLang = 'te-IN';
        langPrefix = 'te';
        break;
      case 'mr':
        text = `${seller} ji, ${raw_quantity} ${raw_unit} ${commodity}, ekun ${total_amount_inr} rupaye. Khari karaychi ka?`;
        targetLang = 'mr-IN';
        langPrefix = 'mr';
        break;
      case 'en':
        text = `${seller}, ${raw_quantity} ${raw_unit} ${commodity}, total ${total_amount_inr} rupees. Confirm this deal?`;
        targetLang = 'en-IN';
        langPrefix = 'en';
        break;
      case 'hinglish':
      case 'hi':
      default:
        text = `${seller} ji, ${raw_quantity} ${raw_unit} ${commodity}, kul ${total_amount_inr} rupaye. Confirm karein?`;
        targetLang = 'hi-IN';
        langPrefix = 'hi';
        break;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.lang = targetLang;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(
      (v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix)
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('TTS playback error:', err);
  }
}

export default speakTradeSummary;
