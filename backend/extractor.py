import json
import os
import re
from groq import Groq

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY, timeout=3.5) if GROQ_API_KEY else None

SYSTEM_PROMPT = """You are the MandiVoice Extraction Engine for Indian agricultural trade dialogues.
Extract transaction entities and map regional terms in English, Hindi (Devanagari), Hinglish, Telugu, and Marathi.
Commodities:
- Wheat: gehu/gehun/गेहूं, godhumalu/గోధుమలు (Telugu), gahu/गहू (Marathi) -> wheat
- Mustard: sarson/सरसों, avalu/ఆవాలు (Telugu), mohari/मोहरी (Marathi) -> mustard
- Chana: chana/चना, senagalu/శనగలు (Telugu), harbhara/हरभरा (Marathi) -> chana
- Paddy: dhaan/धान, vadlu/వడ్లు (Telugu), bhat/भात (Marathi) -> paddy
- Cotton: kapas/कपास, pathi/పత్తి (Telugu), kapus/कापूस (Marathi) -> cotton
- Soybean: soybean/सोयाबीन/సోయాబీన్ -> soybean
Units:
- bori/बोरी, bastalu/బస్తాలు (Telugu), pishvi/goni/पोते (Marathi) -> bori
- quintal/क्विंटल/క్వింటా -> quintal
- mann/मन/మణుగు -> mann
- dharhi/धड़ी -> dharhi
- kg/kilo/किलो/కిలో -> kg
Rate unit: per_quintal or per_kg.
Return strictly valid JSON with exact keys:
buyer_name, seller_name, commodity, raw_quantity, raw_unit, standard_quantity_kg, negotiated_rate, rate_unit, total_amount_inr, confidence_score"""

COMMODITY_MAP = {
    # Latin / Hinglish / Regional romanized
    "gehu": "wheat", "gehun": "wheat", "wheat": "wheat", "kanak": "wheat", "godhumalu": "wheat", "godhuma": "wheat", "gahu": "wheat",
    "sarson": "mustard", "mustard": "mustard", "rai": "mustard", "avalu": "mustard", "aavalu": "mustard", "mohari": "mustard",
    "chana": "chana", "gram": "chana", "senagalu": "chana", "sanagalu": "chana", "harbhara": "chana",
    "dhaan": "paddy", "paddy": "paddy", "rice": "paddy", "chawal": "paddy", "vadlu": "paddy", "bhat": "paddy",
    "soybean": "soybean", "soya": "soybean", "soyabean": "soybean",
    "cotton": "cotton", "kapas": "cotton", "narma": "cotton", "pathi": "cotton", "patti": "cotton", "kapus": "cotton",
    # Devanagari (Hindi / Marathi)
    "गेहूं": "wheat", "गेहू": "wheat", "कनक": "wheat", "गहू": "wheat",
    "सरसों": "mustard", "सरसो": "mustard", "राई": "mustard", "मोहरी": "mustard",
    "चना": "chana", "चने": "chana", "हरभरा": "chana",
    "धान": "paddy", "चावल": "paddy", "भात": "paddy",
    "सोयाबीन": "soybean", "सोयबीन": "soybean",
    "कपास": "cotton", "नरमा": "cotton", "रूई": "cotton", "रुई": "cotton", "कापूस": "cotton",
    # Telugu Script
    "గోధుమలు": "wheat", "గోధుమ": "wheat",
    "ఆవాలు": "mustard",
    "శనగలు": "chana", "శనగ": "chana",
    "వడ్లు": "paddy",
    "సోయాబీన్": "soybean",
    "పత్తి": "cotton",
}

UNIT_MAP = {
    # English / Latin
    "bori": "bori", "bastalu": "bori", "basta": "bori", "pishvi": "bori", "goni": "bori", "katta": "bori", "bag": "bori", "bags": "bori",
    "quintal": "quintal", "quintals": "quintal", "quintalu": "quintal", "kuintal": "quintal",
    "mann": "mann", "man": "mann", "manugu": "mann",
    "dharhi": "dharhi", "dadi": "dharhi",
    "kg": "kg", "kilo": "kg", "kgs": "kg",
    # Devanagari (Hindi / Marathi)
    "बोरी": "bori", "बोरियां": "bori", "कट्टा": "bori", "कट्टे": "bori", "पोती": "bori", "पोते": "bori", "गोणी": "bori", "पिशवी": "bori",
    "क्विंटल": "quintal", "कुंतल": "quintal", "क्विन्टल": "quintal",
    "मन": "mann", "मण": "mann",
    "धड़ी": "dharhi", "धड़ी": "dharhi",
    "किलो": "kg", "किग्रा": "kg", "किलोग्रॅम": "kg",
    # Telugu
    "బస్తాలు": "bori", "బస్తా": "bori",
    "క్వింటా": "quintal", "క్వింటాల్": "quintal",
    "మణుగు": "mann",
    "కిలో": "kg",
}


def _fallback_extraction(transcript: str) -> dict:
    text = transcript.lower()

    # 1. Match Commodity
    commodity = "wheat"
    for term, mapped in COMMODITY_MAP.items():
        if term in text:
            commodity = mapped
            break

    # 2. Match Quantity and Unit
    raw_quantity = 10.0
    raw_unit = "quintal"

    # Regex matching numeric digits followed by unit
    unit_regex = (
        r"(\d+(?:\.\d+)?)\s*"
        r"(bori|bastalu|basta|pishvi|goni|katta|bag|bags|quintal|quintals|quintalu|kuintal|mann|man|manugu|dharhi|dadi|kg|kilo|kgs|"
        r"बोरी|बोरियां|कट्टा|कट्टे|पोती|पोते|गोणी|पिशवी|क्विंटल|कुंतल|क्विन्टल|मन|मण|धड़ी|धड़ी|किलो|किग्रा|किलोग्रॅम|"
        r"బస్తాలు|బస్తా|క్వింటా|క్వింటాల్|మణుగు|కిలో)"
    )
    unit_match = re.search(unit_regex, text)
    if unit_match:
        raw_quantity = float(unit_match.group(1))
        matched_unit = unit_match.group(2)
        raw_unit = UNIT_MAP.get(matched_unit, "quintal")
    else:
        nums = [float(n) for n in re.findall(r"\b\d+(?:\.\d+)?\b", text)]
        raw_quantity = nums[0] if nums else 10.0

    # 3. Match Negotiated Rate
    rate_regex = (
        r"(\d+(?:\.\d+)?)\s*"
        r"(?:rupaye|rs|inr|per|\/|bhav|rate|dar|dharana|ధర|రూపాయలు|रुपये|रूपये|रू|रु|भाव|रेट|दर)"
    )
    rate_match = re.search(rate_regex, text)
    if rate_match and float(rate_match.group(1)) != raw_quantity:
        negotiated_rate = float(rate_match.group(1))
    else:
        all_nums = [float(n) for n in re.findall(r"\b\d+(?:\.\d+)?\b", text)]
        other_nums = [n for n in all_nums if n != raw_quantity]
        default_rates = {
            "wheat": 2425.0,
            "mustard": 5950.0,
            "chana": 5650.0,
            "paddy": 2300.0,
            "soybean": 4892.0,
            "cotton": 7121.0,
        }
        negotiated_rate = other_nums[0] if other_nums else default_rates.get(commodity, 2400.0)

    # 4. Match Rate Unit
    rate_unit = "per_quintal"
    if any(k in text for k in ["per kg", "/kg", "per_kg", "kilo", "prati kilo", "किलो", "प्रति किलो", "కిలో", "కిలోకు"]):
        rate_unit = "per_kg"

    # 5. Extract Names
    buyer_match = re.search(r"(?:buyer|khariddar|vyapari|व्यापारी|खरीदार|కొనుగోలుదారు|ఖరీదుదారు)\s+([a-zA-Z\u0900-\u097F\u0C00-\u0C7F]+)", text)
    seller_match = re.search(r"(?:seller|kisan|kisaan|farmer|किसान|రైతు|शेतकरी)\s+([a-zA-Z\u0900-\u097F\u0C00-\u0C7F]+)", text)

    name_phrase = re.search(r"([a-zA-Z\u0900-\u097F\u0C00-\u0C7F]{3,15})\s+(?:का|की|ने|se|ne|చే|నుండి|यांनी|च्या)\b", text)

    seller_name = "Kisan"
    buyer_name = "Trader"

    if seller_match:
        seller_name = seller_match.group(1).title()
    elif name_phrase:
        seller_name = name_phrase.group(1).title()

    if buyer_match:
        buyer_name = buyer_match.group(1).title()

    return {
        "buyer_name": buyer_name,
        "seller_name": seller_name,
        "commodity": commodity,
        "raw_quantity": raw_quantity,
        "raw_unit": raw_unit,
        "standard_quantity_kg": 0.0,
        "negotiated_rate": negotiated_rate,
        "rate_unit": rate_unit,
        "total_amount_inr": 0.0,
        "confidence_score": 0.85,
    }


def extract_trade_from_text(transcript: str) -> dict:
    if client:
        try:
            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": transcript},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
                timeout=3.5,
            )
            content = resp.choices[0].message.content or "{}"
            data = json.loads(content)
            data["raw_quantity"] = float(data.get("raw_quantity", 0))
            data["negotiated_rate"] = float(data.get("negotiated_rate", 0))
            raw_c = str(data.get("commodity", "wheat")).lower()
            data["commodity"] = COMMODITY_MAP.get(raw_c, raw_c)
            raw_u = str(data.get("raw_unit", "quintal")).lower()
            data["raw_unit"] = UNIT_MAP.get(raw_u, "quintal")
            data["rate_unit"] = str(data.get("rate_unit", "per_quintal")).lower()
            return data
        except Exception:
            pass
    return _fallback_extraction(transcript)


def transcribe_audio(file_bytes: bytes, filename: str = "audio.wav") -> str:
    if client:
        try:
            transcription = client.audio.transcriptions.create(
                file=(filename or "audio.wav", file_bytes),
                model="whisper-large-v3",
                prompt="Indian agricultural trade dialogue in mandi: Hindi, Telugu, Marathi, Hinglish, English. Terms: gehu, godhumalu, gahu, chana, senagalu, harbhara, vadlu, dhaan, bori, bastalu, quintal.",
                response_format="json",
                timeout=8.0,
            )
            return getattr(transcription, "text", str(transcription))
        except Exception as e:
            return f"[Transcription error: {e}]"
    return "[Audio transcription unavailable: GROQ_API_KEY not set]"
