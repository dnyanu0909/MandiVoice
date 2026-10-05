// Client-side offline trade parser for Indian agricultural mandi dialogues
// Supports Hindi, Marathi, Telugu, Hinglish, and English

const COMMODITY_MAP = {
  // English / Hinglish
  gehu: 'wheat', gehun: 'wheat', wheat: 'wheat', kanak: 'wheat', godhumalu: 'wheat', godhuma: 'wheat', gahu: 'wheat',
  sarson: 'mustard', mustard: 'mustard', rai: 'mustard', avalu: 'mustard', aavalu: 'mustard', mohari: 'mustard',
  chana: 'chana', gram: 'chana', senagalu: 'chana', sanagalu: 'chana', harbhara: 'chana',
  dhaan: 'paddy', paddy: 'paddy', rice: 'paddy', chawal: 'paddy', vadlu: 'paddy', bhat: 'paddy',
  soybean: 'soybean', soya: 'soybean', soyabean: 'soybean',
  cotton: 'cotton', kapas: 'cotton', narma: 'cotton', pathi: 'cotton', patti: 'cotton', kapus: 'cotton',
  // Devanagari (Hindi / Marathi)
  'गेहूं': 'wheat', 'गेहू': 'wheat', 'कनक': 'wheat', 'गहू': 'wheat',
  'सरसों': 'mustard', 'सरसो': 'mustard', 'राई': 'mustard', 'मोहरी': 'mustard',
  'चना': 'chana', 'चने': 'chana', 'हरभरा': 'chana',
  'धान': 'paddy', 'चावल': 'paddy', 'भात': 'paddy',
  'सोयाबीन': 'soybean', 'सोयबीन': 'soybean',
  'कपास': 'cotton', 'नरमा': 'cotton', 'कापूस': 'cotton',
  // Telugu
  'గోధుమలు': 'wheat', 'గోధుమ': 'wheat',
  'ఆవాలు': 'mustard',
  'శనగలు': 'chana', 'శనగ': 'chana',
  'వడ్లు': 'paddy',
  'సోయాబీన్': 'soybean',
  'పత్తి': 'cotton',
};

const UNIT_MAP = {
  bori: 'bori', bastalu: 'bori', basta: 'bori', pishvi: 'bori', goni: 'bori', katta: 'bori', bag: 'bori', bags: 'bori',
  'बोरी': 'bori', 'बोरियां': 'bori', 'कट्टा': 'bori', 'कट्टे': 'bori', 'पोती': 'bori', 'पोते': 'bori', 'गोणी': 'bori', 'पिशवी': 'bori',
  'బస్తాలు': 'bori', 'బస్తా': 'bori',
  quintal: 'quintal', quintals: 'quintal', quintalu: 'quintal', kuintal: 'quintal',
  'क्विंटल': 'quintal', 'कुंतल': 'quintal', 'క్వింటా': 'quintal', 'క్వింటాల్': 'quintal',
  mann: 'mann', man: 'mann', manugu: 'mann',
  'मन': 'mann', 'मण': 'mann', 'మణుగు': 'mann',
  dharhi: 'dharhi', dadi: 'dharhi', 'धड़ी': 'dharhi', 'धड़ी': 'dharhi',
  kg: 'kg', kilo: 'kg', kgs: 'kg', 'किलो': 'kg', 'किग्रा': 'kg', 'కిలో': 'kg',
};

const UNIT_MULTIPLIERS = {
  bori: 50.0,
  quintal: 100.0,
  mann: 40.0,
  dharhi: 5.0,
  kg: 1.0,
};

const MSP_DATA = {
  wheat: 2425.0,
  mustard: 5950.0,
  chana: 5650.0,
  paddy: 2300.0,
  soybean: 4892.0,
  cotton: 7121.0,
};

export function parseOfflineTrade(text) {
  if (!text || typeof text !== 'string') return null;
  const rawText = text.trim();
  const lower = rawText.toLowerCase();

  // 1. Identify Commodity
  let commodity = 'wheat';
  for (const [key, val] of Object.entries(COMMODITY_MAP)) {
    if (lower.includes(key.toLowerCase()) || rawText.includes(key)) {
      commodity = val;
      break;
    }
  }

  // 2. Identify Quantity & Unit
  let rawQuantity = 10.0;
  let rawUnit = 'quintal';

  const unitRegex = /(\d+(?:\.\d+)?)\s*(bori|bastalu|basta|pishvi|goni|katta|bag|bags|quintal|quintals|quintalu|kuintal|mann|man|manugu|dharhi|dadi|kg|kilo|kgs|बोरी|बोरियां|कट्टा|कट्टे|पोती|पोते|गोणी|पिशवी|क्विंटल|कुंतल|मन|मण|धड़ी|धड़ी|किलो|किग्रा|బస్తాలు|బస్తా|క్వింటా|క్వింటాల్|మణుగు|కిలో)/i;
  const unitMatch = rawText.match(unitRegex);

  if (unitMatch) {
    rawQuantity = parseFloat(unitMatch[1]);
    const uKey = unitMatch[2].toLowerCase();
    rawUnit = UNIT_MAP[uKey] || UNIT_MAP[unitMatch[2]] || 'quintal';
  } else {
    const allNums = (rawText.match(/\b\d+(?:\.\d+)?\b/g) || []).map((n) => parseFloat(n));
    if (allNums.length > 0) {
      rawQuantity = allNums[0];
    }
  }

  // 3. Identify Negotiated Rate
  let negotiatedRate = 2400.0;
  const rateRegex = /(\d+(?:\.\d+)?)\s*(?:rupaye|rs|inr|per|\/|bhav|rate|dar|dharana|ధర|రూపాయలు|रुपये|रूपये|रू|रु|भाव|रेट|दर)/i;
  const rateMatch = rawText.match(rateRegex);

  const allNumbers = (rawText.match(/\b\d+(?:\.\d+)?\b/g) || []).map((n) => parseFloat(n));
  if (rateMatch && parseFloat(rateMatch[1]) !== rawQuantity) {
    negotiatedRate = parseFloat(rateMatch[1]);
  } else {
    const candidates = allNumbers.filter((n) => n !== rawQuantity);
    if (candidates.length > 0) {
      negotiatedRate = candidates[0];
    } else {
      negotiatedRate = MSP_DATA[commodity] || 2400.0;
    }
  }

  // 4. Rate Unit
  let rateUnit = 'per_quintal';
  if (/per\s*kg|\/kg|per_kg|prati\s*kilo|किलो|प्रति\s*किलो|కిలో/i.test(rawText)) {
    rateUnit = 'per_kg';
  }

  // 5. Extract Names
  let sellerName = 'Kisan';
  let buyerName = 'Trader';

  const sellerMatch = rawText.match(/(?:seller|kisan|kisaan|farmer|किसान|రైతు|शेतकरी)\s+([a-zA-Z\u0900-\u097F\u0C00-\u0C7F]+)/i);
  const buyerMatch = rawText.match(/(?:buyer|khariddar|vyapari|व्यापारी|खरीदार|కొనుగోలుదారు|ఖరీదుదారు)\s+([a-zA-Z\u0900-\u097F\u0C00-\u0C7F]+)/i);
  const namePhrase = rawText.match(/([a-zA-Z\u0900-\u097F\u0C00-\u0C7F]{3,15})\s+(?:का|की|ने|se|ne|చే|నుండి|यांनी|च्या|bhai|ji|patil|seth)\b/i);

  if (sellerMatch) sellerName = sellerMatch[1];
  else if (namePhrase) sellerName = namePhrase[1];

  if (buyerMatch) buyerName = buyerMatch[1];

  // 6. Normalization & Math Validation
  const mult = UNIT_MULTIPLIERS[rawUnit] || 100.0;
  const standardQuantityKg = Math.round(rawQuantity * mult * 100) / 100;

  let totalAmountInr = 0.0;
  let effectivePricePerQtl = negotiatedRate;

  if (rateUnit === 'per_kg') {
    totalAmountInr = Math.round(standardQuantityKg * negotiatedRate * 100) / 100;
    effectivePricePerQtl = negotiatedRate * 100.0;
  } else {
    totalAmountInr = Math.round((standardQuantityKg / 100.0) * negotiatedRate * 100) / 100;
    effectivePricePerQtl = negotiatedRate;
  }

  // 7. MSP Evaluation
  const mspRate = MSP_DATA[commodity] || 0.0;
  let belowMsp = false;
  let diffPercentage = 0.0;

  if (mspRate > 0) {
    belowMsp = effectivePricePerQtl < mspRate;
    diffPercentage = Math.round(((effectivePricePerQtl - mspRate) / mspRate) * 10000) / 100;
  }

  return {
    buyer_name: buyerName,
    seller_name: sellerName,
    commodity,
    raw_quantity: rawQuantity,
    raw_unit: rawUnit,
    standard_quantity_kg: standardQuantityKg,
    negotiated_rate: negotiatedRate,
    rate_unit: rateUnit,
    total_amount_inr: totalAmountInr,
    below_msp: belowMsp,
    diff_percentage: diffPercentage,
    benchmark_msp: mspRate,
    confidence_score: 0.9,
    is_offline: true,
  };
}
