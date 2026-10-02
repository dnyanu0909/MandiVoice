export function calculateApmcDeductions(trade) {
  if (!trade) {
    return {
      gross: 0,
      hamali: 0,
      mandiCess: 0,
      totalDeductions: 0,
      netPayout: 0,
    };
  }

  const gross = Number(trade.total_amount_inr) || 0;
  const rawUnit = (trade.raw_unit || '').toLowerCase();
  const rawQty = Number(trade.raw_quantity) || 0;
  const stdKg = Number(trade.standard_quantity_kg) || 0;

  // Hamali (Labour/Unloading): ₹10 per bag/bori, or ₹20 per quintal
  let hamali = 0;
  if (rawUnit === 'bori') {
    hamali = Math.round(rawQty * 10);
  } else {
    hamali = Math.round((stdKg / 100) * 20);
  }

  // APMC Mandi Cess: 1.5% of Gross Deal Value
  const mandiCess = Math.round(gross * 0.015 * 100) / 100;
  const totalDeductions = Math.round((hamali + mandiCess) * 100) / 100;
  const netPayout = Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);

  return {
    gross,
    hamali,
    mandiCess,
    totalDeductions,
    netPayout,
  };
}

export function shareWhatsAppChit(trade) {
  if (!trade) return;
  const seller = trade.seller || trade.seller_name || 'Farmer';
  const buyer = trade.buyer || trade.buyer_name || 'Trader';
  const deductions = calculateApmcDeductions(trade);
  const mspStatus = trade.below_msp ? '⚠️ Below MSP Alert' : '✅ Fair MSP Deal';
  const refId = trade.id ? `MV-${trade.id}` : 'MV-1';

  const chitText = 
`🌾 *MANDIVOICE APMC SAUDA SLIP* 🌾
Ref: #${refId}
--------------------------------
👨‍🌾 Seller: ${seller}
🏢 Buyer: ${buyer}
🌱 Commodity: ${trade.commodity}
⚖️ Qty: ${trade.raw_quantity} ${trade.raw_unit} (${trade.standard_quantity_kg} kg)
💰 Rate: ₹${trade.negotiated_rate} (${trade.rate_unit === 'per_kg' ? 'per kg' : 'per quintal'})
📊 MSP Status: ${mspStatus}
--------------------------------
💵 Gross Total: ₹${Number(trade.total_amount_inr || 0).toLocaleString('en-IN')}
🏷️ Net Farmer Payout: ₹${Number(deductions.netPayout || 0).toLocaleString('en-IN')}
--------------------------------
_Digitally verified via MandiVoice Voice Ledger_`;

  const url = `https://wa.me/?text=${encodeURIComponent(chitText)}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export default calculateApmcDeductions;
