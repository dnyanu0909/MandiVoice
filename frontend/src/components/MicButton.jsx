import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Send } from 'lucide-react';
import { getUIText, LANGUAGES } from '../utils/i18n';

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? window.location.origin
    : 'http://127.0.0.1:8000');

export function MicButton({ onTranscriptParsed, isExtracting = false, currentLang = 'hi' }) {
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fallbackText, setFallbackText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const isLoading = isParsing || isExtracting;
  const ui = getUIText(currentLang);

  const langObj = LANGUAGES.find((l) => l.id === currentLang) || LANGUAGES[0];
  const speechLang = langObj.speechLang || 'hi-IN';

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = speechLang;

        recognition.onstart = () => {
          setIsListening(true);
          setErrorMsg('');
        };

        recognition.onresult = async (event) => {
          const transcript = event.results[0][0].transcript;
          setIsListening(false);
          if (transcript) {
            setFallbackText(transcript);
            await sendTextToBackend(transcript);
          }
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition notice:', e);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization notice:', err);
      }
    }
  }, [speechLang]);

  const sendTextToBackend = async (text) => {
    if (!text || !text.trim() || isLoading) return;
    setIsParsing(true);
    setErrorMsg('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    try {
      const formData = new FormData();
      formData.append('transcript', text.trim());

      const res = await fetch(`${API_BASE}/api/transcribe-and-extract`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (onTranscriptParsed) {
        onTranscriptParsed(data.trade, data.transcript || text);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Extraction error:', err);
      if (err.name === 'AbortError') {
        setErrorMsg(`⏱️ Request timed out. Backend at ${API_BASE} did not respond.`);
      } else {
        setErrorMsg(`⚠️ Cannot connect to Mandi API at ${API_BASE}. Ensure server is running.`);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const sendAudioToBackend = async (blob) => {
    if (isLoading) return;
    setIsParsing(true);
    setErrorMsg('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');

      const res = await fetch(`${API_BASE}/api/transcribe-and-extract`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (onTranscriptParsed) {
        onTranscriptParsed(data.trade, data.transcript);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Audio upload error:', err);
      if (err.name === 'AbortError') {
        setErrorMsg('⏱️ Audio transcription timed out.');
      } else {
        setErrorMsg('⚠️ Audio upload failed. Check backend connection on port 8000.');
      }
    } finally {
      setIsParsing(false);
    }
  };

  const startListening = async () => {
    setErrorMsg('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = speechLang;
        recognitionRef.current.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition fallback to MediaRecorder:', err);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        stream.getTracks().forEach((t) => t.stop());
        sendAudioToBackend(audioBlob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsListening(true);
    } catch (err) {
      console.error('Mic access denied:', err);
      setErrorMsg('Microphone permission denied. Use text box below.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  };

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleFallbackSubmit = (e) => {
    e.preventDefault();
    sendTextToBackend(fallbackText);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto my-4">
      {/* Microphone Push-to-Talk Button */}
      <div className="relative flex items-center justify-center my-4">
        {isListening && (
          <>
            <span className="absolute -inset-4 rounded-full bg-red-600/30 animate-ping pointer-events-none" />
            <span className="absolute -inset-8 rounded-full bg-red-600/20 animate-pulse pointer-events-none" />
          </>
        )}

        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center transition-transform active:scale-95 shadow-2xl focus:outline-none ${
            isListening
              ? 'bg-red-600 text-white ring-8 ring-red-300'
              : isLoading
              ? 'bg-slate-700 text-amber-300 ring-4 ring-amber-300/30 cursor-wait'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-200'
          }`}
          aria-label={isListening ? 'Stop listening' : 'Start Push-to-Talk'}
        >
          {isLoading ? (
            <Loader2 className="w-10 h-10 animate-spin mb-1 text-amber-300" />
          ) : isListening ? (
            <Square className="w-10 h-10 mb-1 fill-current animate-pulse" />
          ) : (
            <Mic className="w-10 h-10 mb-1" />
          )}

          <span className="text-xs font-black uppercase tracking-wider">
            {isLoading ? ui.parsingBtn : isListening ? 'Listening' : 'Push To Talk'}
          </span>
        </button>
      </div>

      <p className="text-xs font-bold text-slate-700 text-center mb-3">
        {isLoading
          ? '⏳ Analyzing trade entities & MSP benchmark...'
          : isListening
          ? ui.listening
          : ui.tapToSpeak}
      </p>

      {errorMsg && (
        <p className="text-xs font-bold text-red-700 bg-red-50 p-2.5 rounded-xl border-2 border-red-200 mb-3 text-center w-full shadow-sm animate-fade-in">
          {errorMsg}
        </p>
      )}

      {/* Fallback Text Input */}
      <form onSubmit={handleFallbackSubmit} className="w-full flex gap-2 mt-1">
        <input
          type="text"
          value={fallbackText}
          disabled={isLoading}
          onChange={(e) => setFallbackText(e.target.value)}
          placeholder={ui.placeholder}
          className="flex-1 text-sm bg-white border-2 border-slate-300 rounded-xl px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-sm disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={isLoading || !fallbackText.trim()}
          className="bg-slate-900 hover:bg-slate-800 text-white font-black text-sm px-4 py-2.5 rounded-xl shadow cursor-pointer disabled:opacity-50 flex items-center gap-1.5 transition-transform active:scale-95"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>{ui.parsingBtn}</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>{ui.parseBtn}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default MicButton;
