import React, { useState, useEffect } from 'react';
import { Volume2, CheckCircle2, AlertTriangle, Edit3, Check, CheckCircle, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { speakTradeSummary } from '../utils/tts';
import { saveOfflineTrade } from '../utils/offlineDb';
import { calculateApmcDeductions } from '../utils/apmcFees';
import { getUIText } from '../utils/i18n';

const API_BASE = 'http://127.0.0.1:8000';

const UNIT_MULTIPLIERS = {
  bori: 50,
  quintal: 100,
  mann: 40,
  dharhi: 5,
  kg: 1,
};

export function TradeCard({ trade, onTradeConfirmed, onTradeUpdated, currentLang = 'hi' }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [showDeductionDetails, setShowDeductionDetails] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [editForm, setEditForm] = useState(trade || {});

  const ui = getUIText(currentLang);

  useEffect(() => {
    setEditForm(trade || {});
    setCommitMessage('');
  }, [trade]);

  if (!trade) return null;

  const handleReplayAudio = () => {
    speakTradeSummary(trade, currentLang);
  };

  const handleSaveEdit = () => {
    const raw_qty = Number(editForm.raw_quantity) || 0;
    const rate = Number(editForm.negotiated_rate) || 0;
    const unitKey = (editForm.raw_unit || 'quintal').toLowerCase();
    const mult = UNIT_MULTIPLIERS[unitKey] || 100;
    const stdKg = Math.round(raw_qty * mult * 100) / 100;

    let total = 0;
    if (editForm.rate_unit === 'per_kg') {
      total = Math.round(stdKg * rate * 100) / 100;
    } else {
      total = Math.round((stdKg / 100) * rate * 100) / 100;
    }

    const updated = {
      ...trade,
      ...editForm,
      raw_quantity: raw_qty,
      negotiated_rate: rate,
      standard_quantity_kg: stdKg,
      total_amount_inr: total,
    };

    if (onTradeUpdated) onTradeUpdated(updated);
    setIsEditing(false);
  };

  const handleConfirmAndCommit = async () => {
    try {
      setIsCommitting(true);
      setCommitMessage('');

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const saved = await saveOfflineTrade(trade);
        setCommitMessage('🟠 Device Offline: Saved to Offline Ledger (Auto-syncs when online)');
        if (onTradeConfirmed) onTradeConfirmed({ ...trade, id: `offline-${saved.id || Date.now()}`, is_offline: true });
        return;
      }

      // Try online commit
      const res = await fetch(`${API_BASE}/api/confirm-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      });

      if (!res.ok) {
        throw new Error(`Commit failed: ${res.statusText}`);
      }

      const data = await res.json();
      setCommitMessage(`✓ Trade #${data.id || ''} Confirmed & Committed to Mandi Cloud!`);

      if (onTradeConfirmed) {
        onTradeConfirmed(data);
      }
    } catch (err) {
      console.warn('Network error, saving to offline IndexedDB:', err);
      try {
        const saved = await saveOfflineTrade(trade);
        setCommitMessage('🟠 Saved to Offline Ledger (Auto-syncs when reconnected)');
        if (onTradeConfirmed) onTradeConfirmed({ ...trade, id: `offline-${saved.id || Date.now()}`, is_offline: true });
      } catch (dbErr) {
        setCommitMessage('Failed to save trade. Please try again.');
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const weightInQuintals = (Number(trade.standard_quantity_kg || 0) / 100).toFixed(2);
  const diffDisplay = trade.diff_percentage !== undefined ? Math.abs(trade.diff_percentage) : 0;
  const deductions = calculateApmcDeductions(trade);

  return (
    <div
      className={`w-full max-w-md mx-auto my-4 bg-white rounded-2xl shadow-xl border-4 overflow-hidden transition-all ${
        trade.below_msp ? 'border-red-500' : 'border-emerald-500'
      }`}
    >
      {/* MSP Flag Banner */}
      <div
        className={`px-4 py-3 flex items-center justify-between font-black text-sm text-white ${
          trade.below_msp ? 'bg-red-600' : 'bg-emerald-600'
        }`}
      >
        <div className="flex items-center gap-2">
          {trade.below_msp ? (
            <>
              <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />
              <span>{ui.belowMsp} ({diffDisplay}% below benchmark)</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{ui.fairRate}</span>
            </>
          )}
        </div>

        {/* Replay Audio Button */}
        <button
          type="button"
          onClick={handleReplayAudio}
          title="Replay Audio Confirmation"
          className="flex items-center gap-1 bg-black/20 hover:bg-black/30 text-white px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-transform active:scale-95 shadow"
        >
          <Volume2 className="w-4 h-4" />
          <span>Audio</span>
        </button>
      </div>

      {/* Main Trade Details */}
      <div className="p-4 sm:p-5 space-y-4">
        {!isEditing ? (
          <>
            {/* Buyer & Seller */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  {ui.sellerLabel}
                </span>
                <span className="text-base font-black text-slate-900 truncate block">
                  {trade.seller || trade.seller_name || 'Kisan'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  {ui.buyerLabel}
                </span>
                <span className="text-base font-black text-slate-900 truncate block">
                  {trade.buyer || trade.buyer_name || 'Trader'}
                </span>
              </div>
            </div>

            {/* Commodity & Quantity */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  {ui.commodityLabel}
                </span>
                <span className="inline-block bg-amber-100 text-amber-950 font-black text-base px-3 py-1 rounded-lg border border-amber-300 capitalize">
                  🌾 {trade.commodity}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  {ui.quantityLabel}
                </span>
                <span className="text-lg font-black text-slate-900 block capitalize">
                  {trade.raw_quantity} {trade.raw_unit}
                </span>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                  {trade.standard_quantity_kg} kg / {weightInQuintals} Quintals
                </span>
              </div>
            </div>

            {/* Rate & Gross Deal Amount */}
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-inner flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  {ui.rateLabel}
                </span>
                <span className="text-xl font-black text-amber-400">
                  ₹{Number(trade.negotiated_rate || 0).toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-normal text-slate-300">
                    /{trade.rate_unit === 'per_kg' ? 'kg' : 'quintal'}
                  </span>
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  {ui.grossTotal}
                </span>
                <span className="text-2xl font-black text-white tracking-tight font-mono">
                  ₹{Number(trade.total_amount_inr || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* APMC Deductions & Net Farmer In-Hand Payout */}
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                    {ui.netPayout}
                  </span>
                  <span className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
                    ₹{Number(deductions.netPayout || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDeductionDetails(!showDeductionDetails)}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-200/80 hover:bg-emerald-300 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>-₹{deductions.totalDeductions} {ui.apmcFees}</span>
                  {showDeductionDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Deduction Breakdown Details */}
              {showDeductionDetails && (
                <div className="pt-2 border-t border-emerald-200 text-xs space-y-1 font-semibold text-emerald-950">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{ui.grossTotal}:</span>
                    <span>₹{Number(deductions.gross).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{ui.hamali} (₹10/bori or ₹20/qtl):</span>
                    <span className="text-red-700">-₹{deductions.hamali}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{ui.mandiCess} (1.5%):</span>
                    <span className="text-red-700">-₹{deductions.mandiCess}</span>
                  </div>
                  <div className="flex justify-between font-black text-emerald-900 pt-1 border-t border-emerald-200">
                    <span>{ui.netPayout}:</span>
                    <span>₹{Number(deductions.netPayout).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Inline Manual Edit Inputs */
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-300 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-amber-200">
              <span className="text-xs font-black text-amber-900 uppercase">
                ✏️ {ui.editBtn}
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block">{ui.sellerLabel}</label>
                <input
                  type="text"
                  value={editForm.seller || editForm.seller_name || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, seller: e.target.value, seller_name: e.target.value })
                  }
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block">{ui.buyerLabel}</label>
                <input
                  type="text"
                  value={editForm.buyer || editForm.buyer_name || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, buyer: e.target.value, buyer_name: e.target.value })
                  }
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block">{ui.commodityLabel}</label>
                <input
                  type="text"
                  value={editForm.commodity || ''}
                  onChange={(e) => setEditForm({ ...editForm, commodity: e.target.value })}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg capitalize"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block">{ui.quantityLabel}</label>
                <input
                  type="number"
                  value={editForm.raw_quantity || 0}
                  onChange={(e) =>
                    setEditForm({ ...editForm, raw_quantity: e.target.value })
                  }
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block">Unit</label>
                <select
                  value={(editForm.raw_unit || 'quintal').toLowerCase()}
                  onChange={(e) => setEditForm({ ...editForm, raw_unit: e.target.value })}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                >
                  <option value="bori">bori (50kg)</option>
                  <option value="quintal">quintal (100kg)</option>
                  <option value="mann">mann (40kg)</option>
                  <option value="dharhi">dharhi (5kg)</option>
                  <option value="kg">kg (1kg)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block">Rate (₹)</label>
                <input
                  type="number"
                  value={editForm.negotiated_rate || 0}
                  onChange={(e) =>
                    setEditForm({ ...editForm, negotiated_rate: e.target.value })
                  }
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block">Rate Unit</label>
                <select
                  value={editForm.rate_unit || 'per_quintal'}
                  onChange={(e) => setEditForm({ ...editForm, rate_unit: e.target.value })}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 rounded-lg"
                >
                  <option value="per_quintal">per_quintal</option>
                  <option value="per_kg">per_kg</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveEdit}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 shadow cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply & Recalculate</span>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleConfirmAndCommit}
            disabled={isCommitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-3 px-4 rounded-xl shadow-lg cursor-pointer transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {isCommitting ? 'Committing...' : ui.confirmBtn}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs px-3.5 py-3 rounded-xl border border-slate-300 flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
          >
            <Edit3 className="w-4 h-4" />
            <span>{isEditing ? 'Close' : ui.editBtn}</span>
          </button>
        </div>

        {commitMessage && (
          <p className="text-xs font-bold text-center p-2.5 rounded-xl bg-slate-900 text-emerald-400 border border-slate-700 mt-2 shadow">
            {commitMessage}
          </p>
        )}
      </div>
    </div>
  );
}

export default TradeCard;
