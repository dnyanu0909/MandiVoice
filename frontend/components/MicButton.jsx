import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Send } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export function MicButton({ onTranscriptParsed, isExtracting = false }) {
  const [isListening, setIsListening] = useState(false);
  const [fallbackText, setFallbackText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'hi-IN';

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
          console.warn('Speech recognition error:', e);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err);
      }
    }
  }, []);

  const sendTextToBackend = async (text) => {
    if (!text || !text.trim()) return;
    try {
      const formData = new FormData();
      formData.append('transcript', text.trim());

      const res = await fetch(${API_BASE}/api/transcribe-and-extract, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(Server returned status );
      }

      const data = await res.json();
      if (onTranscriptParsed) {
        onTranscriptParsed(data.trade, data.transcript || text);
      }
    } catch (err) {
      console.error('Failed to extract trade:', err);
      setErrorMsg('Extraction error. Please check backend connection.');
    }
  };

  const sendAudioToBackend = async (blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');

      const res = await fetch(${API_BASE}/api/transcribe-and-extract, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(Server returned status );
      }

      const data = await res.json();
      if (onTranscriptParsed) {
        onTranscriptParsed(data.trade, data.transcript);
      }
    } catch (err) {
      console.error('Failed to transcribe audio:', err);
      setErrorMsg('Audio upload error. Try text fallback.');
    }
  };

  const startListening = async () => {
    setErrorMsg('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition start failed, trying MediaRecorder:', err);
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
      console.error('Mic access denied or unavailable:', err);
      setErrorMsg('Microphone not available. Please use the text input below.');
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
          disabled={isExtracting}
          className={
elative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center transition-transform active:scale-95 shadow-2xl focus:outline-none  }
          aria-label={isListening ? 'Stop listening' : 'Start Push-to-Talk'}
        >
          {isExtracting ? (
            <Loader2 className="w-10 h-10 animate-spin mb-1" />
          ) : isListening ? (
            <Square className="w-10 h-10 mb-1 fill-current animate-pulse" />
          ) : (
            <Mic className="w-10 h-10 mb-1" />
          )}

          <span className="text-xs font-black uppercase tracking-wider">
            {isExtracting ? 'Parsing...' : isListening ? 'Listening' : 'Push To Talk'}
          </span>
        </button>
      </div>

      <p className="text-xs font-bold text-slate-700 text-center mb-3">
        {isListening
          ? '🎙️ बोलिए... (Listening in Hindi/Hinglish)'
          : '👆 बटन दबाकर सौदा बोलें (Tap to record trade dialogue)'}
      </p>

      {errorMsg && (
        <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 mb-3 text-center w-full">
          {errorMsg}
        </p>
      )}

      <form onSubmit={handleFallbackSubmit} className="w-full flex gap-2 mt-1">
        <input
          type="text"
          value={fallbackText}
          onChange={(e) => setFallbackText(e.target.value)}
          placeholder="Or paste Hindi/Hinglish trade text..."
          className="flex-1 text-sm bg-white border-2 border-slate-300 rounded-xl px-3 py-2.5 font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-sm"
        />
        <button
          type="submit"
          disabled={isExtracting || !fallbackText.trim()}
          className="bg-slate-900 hover:bg-slate-800 text-white font-black text-sm px-4 py-2.5 rounded-xl shadow cursor-pointer disabled:opacity-50 flex items-center gap-1.5 transition-transform active:scale-95"
        >
          <Send className="w-4 h-4" />
          <span>Parse</span>
        </button>
      </form>
    </div>
  );
}

export default MicButton;
