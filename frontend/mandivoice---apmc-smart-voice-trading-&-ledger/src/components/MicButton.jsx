import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2, Send } from 'lucide-react';
import { getUIText } from '../utils/i18n';
import { parseOfflineTrade } from '../utils/offlineParser';

const API_BASE =
  (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.trim()) ||
  (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) ||
  '';

export function MicButton({ onTranscriptParsed, isExtracting = false, currentLang = 'hi' }) {
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fallbackText, setFallbackText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoNotice, setInfoNotice] = useState('');

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const accumulatedTranscriptRef = useRef('');
  const isListeningRef = useRef(false);

  const isLoading = isParsing || isExtracting;
  const ui = getUIText(currentLang);

  const getSpeechLang = (lang) => {
    switch ((lang || 'hi').toLowerCase()) {
      case 'te':
      case 'telugu':
        return 'te-IN';
      case 'mr':
      case 'marathi':
        return 'mr-IN';
      case 'en':
      case 'english':
        return 'en-IN';
      case 'hi':
      case 'hinglish':
      default:
        return 'hi-IN';
    }
  };

  const speechLang = getSpeechLang(currentLang);

  const getDisplayApiBase = () => {
    if (API_BASE) return API_BASE;
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return 'local server';
  };

  const processTranscript = useCallback(
    async (text) => {
      if (!text || !text.trim() || isLoading) return;
      const cleanText = text.trim();
      setIsParsing(true);
      setErrorMsg('');
      setInfoNotice('');

      // OFFLINE GUARD: If offline, do not execute external network fetch
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const offlineTrade = parseOfflineTrade(cleanText);
        if (offlineTrade) {
          setInfoNotice('🟠 Mandi Offline Mode: Parsed locally on device.');
          if (onTranscriptParsed) {
            onTranscriptParsed(offlineTrade, cleanText);
          }
        } else {
          setErrorMsg('⚠️ Could not extract trade details from speech.');
        }
        setIsParsing(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      try {
        const formData = new FormData();
        formData.append('transcript', cleanText);

        const fetchUrl = API_BASE
          ? `${API_BASE}/api/transcribe-and-extract`
          : '/api/transcribe-and-extract';

        const res = await fetch(fetchUrl, {
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
          onTranscriptParsed(data.trade, data.transcript || cleanText);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('Extraction network error, checking offline fallback:', err);

        // Fallback to offline parser when network fails
        const offlineTrade = parseOfflineTrade(cleanText);
        if (offlineTrade) {
          setInfoNotice('🟠 Mandi Offline Mode: Network unavailable. Parsed locally on device.');
          if (onTranscriptParsed) {
            onTranscriptParsed(offlineTrade, cleanText);
          }
        } else {
          if (err.name === 'AbortError') {
            setErrorMsg(`⏱️ Request timed out. Backend at ${getDisplayApiBase()} did not respond.`);
          } else {
            setErrorMsg(`⚠️ Cannot connect to Mandi API at ${getDisplayApiBase()}. Ensure server is running.`);
          }
        }
      } finally {
        setIsParsing(false);
      }
    },
    [isLoading, onTranscriptParsed]
  );

  const stopListening = useCallback(
    (shouldSubmit = true) => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      isListeningRef.current = false;
      setIsListening(false);

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

      if (shouldSubmit) {
        const finalTranscript = accumulatedTranscriptRef.current.trim();
        if (finalTranscript) {
          processTranscript(finalTranscript);
        }
      }
    },
    [processTranscript]
  );

  // Initialize SpeechRecognition with continuous=true & interimResults=true
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = speechLang;

        recognition.onstart = () => {
          isListeningRef.current = true;
          setIsListening(true);
          setErrorMsg('');
          setInfoNotice('');
        };

        recognition.onresult = (event) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript;
          }

          if (fullTranscript) {
            accumulatedTranscriptRef.current = fullTranscript;
            setFallbackText(fullTranscript);

            // 2000ms silence debounce timer: do not auto-stop on short pauses
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            silenceTimerRef.current = setTimeout(() => {
              if (isListeningRef.current) {
                stopListening(true);
              }
            }, 2000);
          }
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition notice:', e);
          if (e.error === 'not-allowed') {
            setErrorMsg('Microphone permission denied. Enable microphone access or use text input.');
            stopListening(false);
          }
        };

        recognition.onend = () => {
          if (isListeningRef.current) {
            // Keep active if user did not stop and silence timer hasn't expired yet
            try {
              recognition.start();
            } catch {
              setIsListening(false);
              isListeningRef.current = false;
            }
          } else {
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization notice:', err);
      }
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [speechLang, stopListening]);

  const sendAudioToBackend = async (blob) => {
    if (isLoading) return;
    setIsParsing(true);
    setErrorMsg('');
    setInfoNotice('');

    // Offline Guard for audio blob
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMsg('🟠 Offline: Voice recording requires network. Please use text input below for offline parsing.');
      setIsParsing(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');

      const fetchUrl = API_BASE
        ? `${API_BASE}/api/transcribe-and-extract`
        : '/api/transcribe-and-extract';

      const res = await fetch(fetchUrl, {
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
        setErrorMsg(`⚠️ Cannot connect to Mandi API at ${getDisplayApiBase()}. Ensure server is running.`);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const startListening = async () => {
    setErrorMsg('');
    setInfoNotice('');
    accumulatedTranscriptRef.current = '';
    setFallbackText('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = speechLang;
        recognitionRef.current.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition start fallback to MediaRecorder:', err);
      }
    }

    // MediaRecorder Fallback if Web Speech API unavailable
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
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err) {
      console.error('Mic access denied:', err);
      setErrorMsg('Microphone permission denied. Use text box below.');
    }
  };

  // Toggle listening on/off cleanly with Push-To-Talk button
  const handleToggle = () => {
    if (isListening) {
      stopListening(true);
    } else {
      startListening();
    }
  };

  const handleFallbackSubmit = (e) => {
    e.preventDefault();
    processTranscript(fallbackText);
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

      {/* Amber Offline Info Notification */}
      {infoNotice && (
        <p className="text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-xl border-2 border-amber-300 mb-3 text-center w-full shadow-sm animate-fade-in">
          {infoNotice}
        </p>
      )}

      {/* Error Alert Banner */}
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
