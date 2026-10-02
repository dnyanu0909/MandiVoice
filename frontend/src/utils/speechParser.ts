import { TradeSlip } from '../types/mandi';
import { mspRatesList } from '../data/mockData';

interface ParsedTradeResult {
  matched: boolean;
  cropNameEn: string;
  cropNameHi: string;
  weightQuintal: number;
  bagsCount: number;
  unitRatePerQtl: number;
  buyerName: string;
  sellerName: string;
  mspRatePerQtl: number;
  confidence: number;
}

export function parseSpokenTrade(transcript: string): ParsedTradeResult {
  const text = transcript.toLowerCase();

  // Detect crop
  let cropNameEn = 'Lokwan Wheat';
  let cropNameHi = 'लोकवन गेहूं';
  let mspRatePerQtl = 2275;

  if (text.includes('गेहूं') || text.includes('गेहु') || text.includes('wheat') || text.includes('लोकवन')) {
    cropNameEn = 'Lokwan Wheat';
    cropNameHi = 'लोकवन गेहूं';
    mspRatePerQtl = 2275;
  } else if (text.includes('सोयाबीन') || text.includes('soybean')) {
    cropNameEn = 'Yellow Soybean';
    cropNameHi = 'पीली सोयाबीन JS-9560';
    mspRatePerQtl = 4892;
  } else if (text.includes('सरसों') || text.includes('रायडा') || text.includes('mustard')) {
    cropNameEn = 'Mustard (Sarson)';
    cropNameHi = 'सरसों 45S46 (Mustard)';
    mspRatePerQtl = 5650;
  } else if (text.includes('चना') || text.includes('chana') || text.includes('gram')) {
    cropNameEn = 'Desi Chana (Gram)';
    cropNameHi = 'देसी चना विशाल (Gram)';
    mspRatePerQtl = 5440;
  } else if (text.includes('लहसुन') || text.includes('garlic') || text.includes('ऊटी')) {
    cropNameEn = 'Neemuch Garlic';
    cropNameHi = 'देसी ऊटी लहसुन (Garlic)';
    mspRatePerQtl = 0;
  } else if (text.includes('मक्का') || text.includes('maize')) {
    cropNameEn = 'Maize (मक्का)';
    cropNameHi = 'पीली मक्का (Hybrid)';
    mspRatePerQtl = 2090;
  }

  // Detect numbers for weight and rate
  // Look for patterns like "45 क्विंटल", "45 qtl", "45 बोरी", "2480 रुपये", "2480 भाव"
  const numbers = text.match(/\d+([.,]\d+)?/g);
  let weightQuintal = 45;
  let unitRatePerQtl = 2480;

  if (numbers && numbers.length >= 2) {
    const parsedNums = numbers.map(n => parseFloat(n.replace(',', '')));
    // Usually rate is higher than weight in Indian Mandis (e.g. rate 2000-15000, weight 10-150 qtl)
    const sorted = [...parsedNums].sort((a, b) => a - b);
    if (sorted[0] < 500 && sorted[1] >= 500) {
      weightQuintal = sorted[0];
      unitRatePerQtl = sorted[1];
    } else {
      weightQuintal = parsedNums[0];
      unitRatePerQtl = parsedNums[1];
    }
  } else if (numbers && numbers.length === 1) {
    const val = parseFloat(numbers[0].replace(',', ''));
    if (val > 1000) {
      unitRatePerQtl = val;
    } else {
      weightQuintal = val;
    }
  }

  // Extract names if present
  let buyerName = 'M/s Ramesh Agro Traders';
  let sellerName = 'Suresh Patel (सुरेश पटेल)';

  if (text.includes('रमेश') || text.includes('ramesh')) {
    buyerName = 'M/s Ramesh Agro Traders';
  } else if (text.includes('पाटीदार') || text.includes('patidar') || text.includes('दिनेश')) {
    buyerName = 'Patidar Krishi Kendra';
    sellerName = 'Dinesh Dangi (दिनेश दांगी)';
  } else if (text.includes('शांतिलाल') || text.includes('shantilal') || text.includes('कैलाश')) {
    buyerName = 'Kothari Oil Industries';
    sellerName = 'Ramkishan Jat (रामकिशन जाट)';
  } else if (text.includes('कपूरचंद') || text.includes('kapoor')) {
    buyerName = 'Vardhman Dal Mill';
  }

  const bagsCount = Math.round(weightQuintal);

  return {
    matched: true,
    cropNameEn,
    cropNameHi,
    weightQuintal,
    bagsCount,
    unitRatePerQtl,
    buyerName,
    sellerName,
    mspRatePerQtl,
    confidence: 98
  };
}

export function buildTradeFromSpoken(
  transcript: string,
  currentSlip: TradeSlip
): TradeSlip {
  const parsed = parseSpokenTrade(transcript);
  const totalValue = Math.round(parsed.weightQuintal * parsed.unitRatePerQtl);
  const mspDelta = parsed.mspRatePerQtl > 0 ? (parsed.unitRatePerQtl - parsed.mspRatePerQtl) : 0;
  const isMspCompliant = parsed.mspRatePerQtl === 0 || mspDelta >= 0;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' Today';
  const newSlipNo = `#MV-2024-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    ...currentSlip,
    id: newSlipNo,
    timestamp: timeStr,
    dateTime: now,
    cropNameEn: parsed.cropNameEn,
    cropNameHi: parsed.cropNameHi,
    weightQuintal: parsed.weightQuintal,
    weightKg: parsed.weightQuintal * 100,
    bagsCount: parsed.bagsCount,
    unitRatePerQtl: parsed.unitRatePerQtl,
    totalValue,
    mspRatePerQtl: parsed.mspRatePerQtl,
    mspDeltaPerQtl: mspDelta,
    isMspCompliant,
    buyerFirm: parsed.buyerName,
    sellerName: parsed.sellerName,
    rawVoiceTranscript: transcript,
    voiceTranslation: `Confirm ${parsed.weightQuintal} Qtl ${parsed.cropNameEn} to ${parsed.buyerName} at ₹${parsed.unitRatePerQtl.toLocaleString('en-IN')}/Qtl`,
    status: 'confirmed',
    syncedToCloud: true
  };
}
