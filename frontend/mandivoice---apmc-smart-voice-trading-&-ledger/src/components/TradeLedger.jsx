import React, { useState, useEffect } from 'react';
import { FileText, Printer, X, RefreshCw, AlertTriangle, CheckCircle2, WifiOff, MessageCircle, Share2 } from 'lucide-react';
import { getAllLocalTrades } from '../utils/offlineDb';
import { calculateApmcDeductions, shareWhatsAppChit } from '../utils/apmcFees';
import { getUIText } from '../utils/i18n';

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  '';

export function TradeLedger({ reloadTrigger, currentLang = 'hi' }) {
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  const ui = getUIText(currentLang);

  const fetchTrades = async () => {
    try {
      setIsLoading(true);
      let serverTrades = [];

      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const fetchUrl = API_BASE ? `${API_BASE}/api/trades` : '/api/trades';
          const res = await fetch(fetchUrl);
          if (res.ok) {
            serverTrades = await res.json();
          }
        } catch (e) {
          console.warn('Backend currently unreachable, falling back to local trades:', e);
        }
      }

      // Also get local trades from IndexedDB
      let localTrades = [];
      try {
        localTrades = await getAllLocalTrades();
      } catch (e) {
        console.warn('Error reading local IndexedDB:', e);
      }

      // Filter local trades that are not yet synced
      const unsyncedLocal = (localTrades || [])
        .filter((t) => t.synced === false)
        .map((t) => ({ ...t, is_offline_pending: true }));

      // Merge: Unsynced local trades on top, followed by server trades
      const combined = [...unsyncedLocal, ...(Array.isArray(serverTrades) ? serverTrades : [])];
      setTrades(combined);
    } catch (err) {
      console.error('Failed to fetch trades:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, [reloadTrigger]);

  const slipDeductions = selectedSlip ? calculateApmcDeductions(selectedSlip) : null;

  return (
    <div className="w-full max-w-md mx-auto my-6 bg-white rounded-2xl shadow-xl border-2 border-slate-300 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <h3 className="font-black text-base">{ui.liveLedger}</h3>
          <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
            {trades.length}
          </span>
        </div>

        <button
          type="button"
          onClick={fetchTrades}
          disabled={isLoading}
          className="flex items-center gap-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Trades List */}
      {trades.length === 0 ? (
        <div className="p-8 text-center text-slate-500 font-semibold text-sm">
          No committed trades yet. Confirm a deal above to record here.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
          {trades.map((t, idx) => {
            const seller = t.seller || t.seller_name || 'Farmer';
            const buyer = t.buyer || t.buyer_name || 'Trader';
            const displayId = t.is_offline_pending ? `offline-${t.id}` : `#${t.id || idx + 1}`;
            const itemDeductions = calculateApmcDeductions(t);

            return (
              <div key={t.id || idx} className="p-3.5 hover:bg-slate-50 transition-colors space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-slate-500">{displayId}</span>
                  <div className="flex items-center gap-1.5">
                    {t.is_offline_pending && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                        <WifiOff className="w-2.5 h-2.5" /> Offline Pending
                      </span>
                    )}
                    {t.below_msp ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-300">
                        <AlertTriangle className="w-3 h-3" /> Below MSP
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> Fair Rate
                      </span>
                    )}
                    {t.benchmark_msp > 0 && (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-300">
                        MSP: ₹{t.benchmark_msp}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-baseline">
                  <div>
                    <p className="font-black text-slate-900 text-sm">
                      {seller} <span className="text-slate-400 text-xs font-normal">➔</span> {buyer}
                    </p>
                    <p className="text-xs text-slate-600 font-semibold capitalize">
                      🌾 {t.commodity} • {t.raw_quantity} {t.raw_unit} ({t.standard_quantity_kg} kg)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-emerald-700 font-mono">
                      ₹{Number(t.total_amount_inr || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold">
                      In-Hand: ₹{Number(itemDeductions.netPayout || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="pt-1.5 flex justify-end items-center gap-2">
                  {/* One-Click WhatsApp Share */}
                  <button
                    type="button"
                    onClick={() => shareWhatsAppChit(t)}
                    title="Share Chit on WhatsApp"
                    className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-2.5 py-1 rounded-lg cursor-pointer transition-transform active:scale-95 shadow"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  {/* Open Chit Receipt Modal */}
                  <button
                    type="button"
                    onClick={() => setSelectedSlip(t)}
                    className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-transform active:scale-95 shadow"
                  >
                    <FileText className="w-3 h-3 text-amber-400" />
                    <span>{ui.chitBtn}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Minimal Print & Share Friendly Modal Slip */}
      {selectedSlip && slipDeductions && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border-4 border-slate-900 text-slate-900 space-y-4">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b-2 border-dashed border-slate-300 pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="MandiVoice Logo"
                  className="w-9 h-9 rounded-xl shadow object-contain border border-emerald-600/30 bg-emerald-950/20 p-0.5"
                />
                <div>
                  <h4 className="font-black text-lg text-slate-900 tracking-tight leading-tight">
                    Mandi Sauda Slip (पर्ची)
                  </h4>
                  <p className="text-xs font-mono text-slate-500">
                    Ref: {selectedSlip.id ? `#MV-${selectedSlip.id}` : '#MV-PENDING'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slip Details */}
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-500">{ui.sellerLabel}:</span>
                <span className="font-black text-slate-900">
                  {selectedSlip.seller || selectedSlip.seller_name || 'Kisan'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{ui.buyerLabel}:</span>
                <span className="font-black text-slate-900">
                  {selectedSlip.buyer || selectedSlip.buyer_name || 'Trader'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{ui.commodityLabel}:</span>
                <span className="font-black text-slate-900 capitalize">
                  {selectedSlip.commodity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{ui.quantityLabel}:</span>
                <span className="font-black text-slate-900">
                  {selectedSlip.raw_quantity} {selectedSlip.raw_unit} ({selectedSlip.standard_quantity_kg} kg)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{ui.rateLabel}:</span>
                <span className="font-black text-slate-900">
                  ₹{selectedSlip.negotiated_rate}/{selectedSlip.rate_unit === 'per_kg' ? 'kg' : 'quintal'}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-slate-500">Govt MSP Status:</span>
                <div className="text-right">
                  <span className={`font-black block ${selectedSlip.below_msp ? 'text-red-600' : 'text-emerald-600'}`}>
                    {selectedSlip.below_msp ? '⚠️ Below MSP Alert' : '✅ Fair MSP Deal'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    Compared against APMC MSP: ₹{selectedSlip.benchmark_msp || '2425'}/qtl
                  </span>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>{ui.grossTotal}:</span>
                  <span className="font-bold">₹{Number(slipDeductions.gross).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>{ui.hamali}:</span>
                  <span>-₹{slipDeductions.hamali}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>{ui.mandiCess}:</span>
                  <span>-₹{slipDeductions.mandiCess}</span>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div className="border-t-2 border-dashed border-slate-300 pt-3 flex justify-between items-baseline">
                <span className="text-xs font-black text-emerald-800 uppercase">{ui.netPayout}:</span>
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  ₹{Number(slipDeductions.netPayout || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => shareWhatsAppChit(selectedSlip)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow transition-transform active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{ui.shareWhatsapp}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSlip(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TradeLedger;
