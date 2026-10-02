export type Language = 'hi' | 'en';

export type PaymentMethod = 'cash' | 'rtgs' | 'kcc' | 'neft' | 'cheque';

export interface CommodityMSP {
  id: string;
  nameEn: string;
  nameHi: string;
  category: 'Rabi' | 'Kharif' | 'Commercial';
  mspRate: number; // per Quintal
  currentMarketRate: number; // per Quintal
  unit: string;
  moistureStandard: string;
  season: string;
  arrivalsTodayQtl: number;
}

export interface TradeSlip {
  id: string; // e.g. MV-2024-8841
  timestamp: string; // e.g. 11:42 AM Today
  dateTime: Date;
  buyerName: string;
  buyerFirm: string;
  buyerApmcLic: string;
  sellerName: string;
  sellerVillage: string;
  sellerKccNo: string;
  cropNameEn: string;
  cropNameHi: string;
  cropGrade: string;
  moisturePercent: number;
  weightQuintal: number;
  weightKg: number;
  bagsCount: number;
  bagSizeKg: number;
  unitRatePerQtl: number;
  totalValue: number;
  paymentMethod: PaymentMethod;
  weighbridgeSlipNo: string;
  mspRatePerQtl: number;
  mspDeltaPerQtl: number;
  isMspCompliant: boolean;
  status: 'confirmed' | 'pending' | 'draft' | 'cancelled';
  rawVoiceTranscript?: string;
  voiceTranslation?: string;
  syncedToCloud: boolean;
}

export interface TraderProfile {
  firmName: string;
  traderName: string;
  apmcLicence: string;
  mandiName: string;
  mandiGate: string;
  mobile: string;
  gstin: string;
}

export interface VoicePreset {
  id: string;
  title: string;
  hindiTranscript: string;
  englishTranslation: string;
  trade: Omit<TradeSlip, 'id' | 'timestamp' | 'dateTime' | 'totalValue' | 'mspDeltaPerQtl' | 'isMspCompliant' | 'status' | 'syncedToCloud'>;
}
