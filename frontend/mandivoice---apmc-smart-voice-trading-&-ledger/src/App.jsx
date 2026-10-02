import React, { useState, useEffect, useCallback } from 'react';
import { MicButton } from './components/MicButton';
import { TradeCard } from './components/TradeCard';
import { TradeLedger } from './components/TradeLedger';
import { speakTradeSummary } from './utils/tts';
import { getUnsyncedTrades, markTradesSynced } from './utils/offlineDb';
import { getUIText, LANGUAGES } from './utils/i18n';
import { Wheat, Wifi, WifiOff, RefreshCw, CheckCircle2, Globe } from 'lucide-react';

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://mandi-voice-three.vercel.app'
    : 'http://127.0.0.1:8000');

export function App() {
  const [currentTrade, setCurrentTrade] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [reloadLedgerTrigger, setReloadLedgerTrigger] = useState(0);
  const [currentLang, setCurrentLang] = useState('hi');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const ui = getUIText(currentLang);

  // Auto-sync offline trades to backend
  const syncOfflineTrades = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const unsynced = await getUnsyncedTrades();
      if (!unsynced || unsynced.length === 0) return;

      setIsSyncing(true);
      const payload = unsynced.map((t) => ({
        buyer_name: t.buyer_name || t.buyer || 'Unknown',
        seller_name: t.seller_name || t.seller || 'Unknown',
        commodity: t.commodity,
        raw_quantity: Number(t.raw_quantity) || 0,
        raw_unit: t.raw_unit || 'quintal',
        standard_quantity_kg: Number(t.standard_quantity_kg) || 0,
        negotiated_rate: Number(t.negotiated_rate) || 0,
        rate_unit: t.rate_unit || 'per_quintal',
        total_amount_inr: Number(t.total_amount_inr) || 0,
        confidence_score: Number(t.confidence_score) || 1.0,
      }));

      const res = await fetch(`${API_BASE}/api/sync-offline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        const ids = unsynced.map((t) => t.id);
        await markTradesSynced(ids);
        setReloadLedgerTrigger((prev) => prev + 1);
        setSyncStatusMsg(`✓ Synced ${result.synced_count || unsynced.length} offline trades to Mandi Cloud!`);
        setTimeout(() => setSyncStatusMsg(''), 4000);
      }
    } catch (err) {
      console.warn('Auto-sync failed, will retry next reconnect:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Listen to browser network online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineTrades();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check if already online
    if (navigator.onLine) {
      syncOfflineTrades();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineTrades]);

  const handleTranscriptParsed = (tradeData) => {
    if (tradeData) {
      setCurrentTrade(tradeData);
      speakTradeSummary(tradeData, currentLang);
    }
  };

  const handleTradeConfirmed = () => {
    setReloadLedgerTrigger((prev) => prev + 1);
  };

  const handleTradeUpdated = (updated) => {
    setCurrentTrade(updated);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-3 sm:p-5 font-sans antialiased">
      <main className="max-w-md mx-auto space-y-4">
        {/* Header: APMC MandiVoice Branding & Controls */}
        <header className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl space-y-3 border-2 border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="MandiVoice Logo"
                className="w-10 h-10 rounded-xl shadow-lg object-contain border border-emerald-500/40 bg-emerald-950/60 p-0.5"
              />
              <div>
                <h1 className="font-black text-xl tracking-tight leading-none text-white">
                  MandiVoice
                </h1>
                <p className="text-[11px] font-bold text-amber-400 mt-0.5">
                  {ui.appSubtitle}
                </p>
              </div>
            </div>

            {/* Network Status Pill */}
            <div>
              {isOnline ? (
                <div className="flex items-center gap-1.5 bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-full text-[11px] font-black border border-emerald-600 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Wifi className="w-3 h-3" />
                  <span>Cloud</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-amber-950 text-amber-400 px-2.5 py-1 rounded-full text-[11px] font-black border border-amber-600 shadow-sm">
                  <WifiOff className="w-3.5 h-3.5 animate-bounce" />
                  <span>Offline</span>
                </div>
              )}
            </div>
          </div>

          {/* Language Selector Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>Language / भाषा:</span>
            </div>

            <select
              value={currentLang}
              onChange={(e) => setCurrentLang(e.target.value)}
              className="bg-slate-800 text-amber-300 border border-slate-700 text-xs font-black rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900 text-white font-bold">
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Sync Toast Notification */}
        {syncStatusMsg && (
          <div className="bg-emerald-900 text-emerald-100 border border-emerald-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
        )}

        {isSyncing && (
          <div className="bg-slate-800 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Syncing offline trades to Mandi Cloud...</span>
          </div>
        )}

        {/* Section 1: Push-To-Talk Mic & Fallback Input */}
        <section className="bg-white rounded-2xl p-4 shadow-lg border-2 border-slate-300">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 text-center mb-1">
            {ui.voiceSection}
          </h2>
          <MicButton
            onTranscriptParsed={handleTranscriptParsed}
            isExtracting={isExtracting}
            currentLang={currentLang}
          />
        </section>

        {/* Section 2: Human-in-the-Loop Trade Verification Card with APMC Deductions */}
        {currentTrade && (
          <section>
            <TradeCard
              trade={currentTrade}
              onTradeConfirmed={handleTradeConfirmed}
              onTradeUpdated={handleTradeUpdated}
              currentLang={currentLang}
            />
          </section>
        )}

        {/* Section 3: Live Trade Ledger Table & WhatsApp Chit Sharing */}
        <section>
          <TradeLedger
            reloadTrigger={reloadLedgerTrigger}
            currentLang={currentLang}
          />
        </section>

        {/* Mobile Footer */}
        <footer className="text-center text-xs font-bold text-slate-500 py-3">
          MandiVoice • High-Contrast APMC Mandi Trading Engine
        </footer>
      </main>
    </div>
  );
}

export default App;
