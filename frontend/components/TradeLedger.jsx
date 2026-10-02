import React, { useState, useEffect } from 'react';
import { FileText, Printer, X, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export function TradeLedger({ reloadTrigger }) {
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  const fetchTrades = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(${API_BASE}/api/trades);
      if (res.ok) {
        const data = await res.json();
        setTrades(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch trades:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, [reloadTrigger]);

  return (
    <div className="w-full max-w-md mx-auto my-6 bg-white rounded-2xl shadow-xl border-2 border-slate-300 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <h3 className="font-black text-base">Live Trade Ledger</h3>
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
          <RefreshCw className={w-3.5 h-3.5 } />
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
          {trades.map((t) => {
            const seller = t.seller || t.seller_name || 'Farmer';
            const buyer = t.buyer || t.buyer_name || 'Trader';
            return (
              <div key={t.id} className="p-3.5 hover:bg-slate-50 transition-colors space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-slate-500">#{t.id}</span>
                  {t.below_msp ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-300">
                      <AlertTriangle className="w-3 h-3" /> Below MSP
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3" /> Fair Rate
                    </span>
                  )}
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
                    <p className="text-[11px] text-slate-500 font-semibold">
                      @ ₹{t.negotiated_rate}/{t.rate_unit === 'per_kg' ? 'kg' : 'qtl'}
                    </p>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedSlip(t)}
                    className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-transform active:scale-95 shadow"
                  >
                    <FileText className="w-3 h-3 text-amber-400" />
                    <span>Chit / Receipt</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Minimal Print-Friendly Modal Slip */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border-4 border-slate-900 text-slate-900 space-y-4">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b-2 border-dashed border-slate-300 pb-3">
              <div>
                <h4 className="font-black text-lg text-slate-900 tracking-tight">
                  MandiVoice APMC Chit
                </h4>
                <p className="text-xs font-mono text-slate-500">
                  Slip #{selectedSlip.id} • {new Date(selectedSlip.created_at || Date.now()).toLocaleDateString('en-IN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="text-slate-400 hover:text-slate-800 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slip Data Rows */}
            <div className="space-y-2 text-xs font-semibold text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Seller (किसान):</span>
                <span className="font-bold text-slate-900">
                  {selectedSlip.seller || selectedSlip.seller_name || 'Farmer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Buyer (व्यापारी):</span>
                <span className="font-bold text-slate-900">
                  {selectedSlip.buyer || selectedSlip.buyer_name || 'Trader'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Commodity (फसल):</span>
                <span className="font-bold text-slate-900 capitalize">
                  {selectedSlip.commodity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity (मात्रा):</span>
                <span className="font-bold text-slate-900">
                  {selectedSlip.raw_quantity} {selectedSlip.raw_unit} ({selectedSlip.standard_quantity_kg} kg)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agreed Rate:</span>
                <span className="font-bold text-slate-900">
                  ₹{selectedSlip.negotiated_rate} /{selectedSlip.rate_unit}
                </span>
              </div>

              <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-baseline text-sm">
                <span className="font-black text-slate-900">Total Deal ₹:</span>
                <span className="font-black text-emerald-700 text-lg font-mono">
                  ₹{Number(selectedSlip.total_amount_inr || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Stamp */}
            <div className={p-2 rounded-xl text-center font-black text-xs border-2 }>
              {selectedSlip.below_msp ? '⚠️ BELOW MSP TRANSACTION' : '✓ VERIFIED APMC MANDI TRADE'}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Chit</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TradeLedger;
