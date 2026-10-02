<div align="center">

<img src="frontend/mandivoice---apmc-smart-voice-trading-&-ledger/public/logo.png" alt="MandiVoice Logo" width="120" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);" />

# MandiVoice (मंडीवॉइस)
### APMC Smart Voice Trading, MSP Compliance & Digital Ledger

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Offline First](https://img.shields.io/badge/Storage-IndexedDB_Offline_Sync-green?style=flat)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![Benchmark Accuracy](https://img.shields.io/badge/Benchmark_Accuracy-100%25-brightgreen?style=flat)](#benchmark--evaluation-suite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*A bilingual, voice-first trade extraction engine and APMC price verification ledger tailored for Indian agricultural mandis.*

</div>

---

## 📌 Executive Summary

Agricultural mandis (APMCs) across India handle billions of rupees in grain and produce every day through rapid, verbal auctions. However, the ecosystem faces fundamental friction:
- **Language & Dialect Diversity**: Trading takes place in regional vernaculars (Hindi, Telugu, Marathi, Hinglish) with localized jargon.
- **Non-Metric Units**: Traders quote in regional measures—*Bori* (50 kg), *Mann* (40 kg), *Dharhi* (5 kg), *Katta*, *Bastalu*—leading to arithmetic confusion and exploitation.
- **Price Transparency & MSP Gaps**: Farmers often sell below the Government's Minimum Support Price (MSP) without immediate realization.
- **Mandi Deductions Complexity**: Unloading fees (*Hamali*) and APMC market cess (1.5%) distort in-hand payouts.
- **Unstable Connectivity**: Mandi yards frequently suffer from poor network connectivity, preventing cloud-only apps from operating.

**MandiVoice** bridges this divide with a high-contrast, offline-resilient mobile PWA and high-speed extraction pipeline. It captures natural voice dialogues, normalizes metric weights, verifies real-time MSP compliance, calculates net farmer in-hand payouts, and dispatches verifiable digital chits over WhatsApp.

---

## 🚀 Key Features

### 1. 🎙️ Multi-Lingual Voice Trade Extraction (STT)
- **Push-to-Talk Capture**: One-tap recording using browser-native SpeechRecognition (`hi-IN`, `te-IN`, `mr-IN`, `en-IN`) or compressed audio recording.
- **Hybrid Parsing Pipeline**: Groq Cloud LLM (`llama-3.1-8b-instant` & `whisper-large-v3`) with zero-latency deterministic regex fallback.
- **5-Language Regional UI**: Switch seamlessly between **Hindi (हिंदी)**, **Telugu (తెలుగు)**, **Marathi (मराठी)**, **English**, and **Hinglish**.

### 2. ⚖️ Strict Metric Normalization & Math Fidelity
- Automatically parses and standardizes non-metric measures:
  $$\text{Standard Quantity (kg)} = \text{Raw Quantity} \times \text{Multiplier}$$
  $$\text{Bori} = 50\text{ kg} \quad\vert\quad \text{Quintal} = 100\text{ kg} \quad\vert\quad \text{Mann} = 40\text{ kg} \quad\vert\quad \text{Dharhi} = 5\text{ kg} \quad\vert\quad \text{Kg} = 1\text{ kg}$$
- Strict calculation of deal values with unit normalization for both `per_quintal` and `per_kg` rates.

### 3. 📊 Real-Time MSP Compliance Intelligence
- Validates negotiated prices against official Government benchmarks (*Wheat, Mustard, Chana, Paddy, Soybean, Cotton*).
- **High-Contrast Visual Cues**:
  - 🟢 **Fair Market Rate**: At or above benchmark.
  - 🔴 **Below MSP Alert**: Highlights deviation percentage and per-quintal loss in bright sunlight-readable red.

### 4. 💰 APMC Mandi Deductions Engine
- Automatically deducts standard regulated market fees:
  - **Hamali (Labour/Unloading)**: ₹10 per bag/bori (or ₹20 per quintal)
  - **APMC Mandi Cess**: 1.5% of Gross Deal Value
  - **Net Farmer Payout**: $\text{Gross} - \text{Hamali} - \text{Mandi Cess}$
- Interactive breakdown toggle provides transparent itemized receipts for both farmers and commission agents.

### 5. 🗣️ Audible Regional Voice Confirmation (TTS)
- Automatic text-to-speech confirmation in the selected language:
  - **Hindi**: *"{seller} ji, {qty} {unit} {commodity}, kul ₹{total}. Confirm karein?"*
  - **Telugu**: *"{seller} garu, {qty} {unit} {commodity}, motham ₹{total}. Confirm cheyala?"*
  - **Marathi**: *"{seller} ji, {qty} {unit} {commodity}, ekun ₹{total}. Khari karaychi ka?"*
  - **English**: *"{seller}, {qty} {unit} {commodity}, total ₹{total}. Confirm this deal?"*

### 6. 📶 Offline-Tolerant Cache & Auto-Sync (IndexedDB)
- Mandi transactions can be confirmed and logged even when completely offline.
- Backed by native browser `IndexedDB` (`MandiVoiceDB`, store `offline_trades`).
- Displays live network pill: **🟢 Online (Mandi Cloud)** vs. **🟠 Offline Mode (Local Storage)**.
- Reconnection listener automatically batches pending offline trades and synchronizes them with the backend (`POST /api/sync-offline`).

### 7. 📲 One-Click WhatsApp Chit Dispatch & Thermal Printing
- Generates instant formatted digital chits and deep-links directly to WhatsApp (`https://wa.me/?text=...`).
- Printable Mandi Sauda Slip (पर्ची) modal formatted for handheld POS thermal printers.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client["📱 Frontend PWA (React 19 + Vite)"]
        UI["High-Contrast Sunlight UI"]
        Mic["🎙️ Push-to-Talk / Text Fallback"]
        TTS["🗣️ Multi-Lingual SpeechSynthesis"]
        IDB[("IndexedDB Local Cache\n(MandiVoiceDB)")]
        Slip["📄 Sauda Chit & WhatsApp DeepLink"]
    end

    subgraph Backend["⚡ Backend API (FastAPI)"]
        Router["FastAPI Router (Port 8000)"]
        Norm["Metric Normalizer & Math Enforcer"]
        MSPDB[("MSP Benchmark Data\n(msp_data.json)")]
        SQLite[("SQLite Database\n(trades.db)")]
    end

    subgraph AI["☁️ Speech & LLM Pipeline"]
        Whisper["Groq Whisper-Large-v3 (STT)"]
        LLM["Groq LLaMA-3.1-8b-Instant"]
        Fallback["Zero-Latency Regex Parser"]
    end

    Mic -->|Audio / Text| Router
    Router -->|Audio File| Whisper
    Whisper -->|Transcript| LLM
    Router -->|Text| LLM
    LLM -.->|Fail / Timeout >3.5s| Fallback
    LLM --> Norm
    Fallback --> Norm
    Norm <--> MSPDB
    Norm --> UI
    UI --> TTS
    UI -->|Online| Router
    UI -->|Offline| IDB
    IDB -->|Network Restored| Router
    Router --> SQLite
    UI --> Slip
```

---

## 📁 Repository Structure

```text
MandiVoice/
├── backend/
│   ├── extractor.py           # Multi-lingual speech & entity extraction (Groq + Fallback)
│   ├── main.py                # FastAPI routes, SQLAlchemy models, and SQLite setup
│   ├── msp_data.json          # Government benchmark MSP reference rates
│   └── requirements.txt       # Backend dependencies
├── eval/
│   ├── benchmark_eval.py      # Automated 12-case benchmark evaluation suite
│   └── benchmark_results.json # Exported benchmark evaluation report
├── frontend/
│   ├── package.json           # Frontend launcher scripts
│   └── mandivoice---apmc-smart-voice-trading-&-ledger/
│       ├── public/
│       │   └── logo.png       # Official MandiVoice brand logo & favicon
│       ├── src/
│       │   ├── components/
│       │   │   ├── MicButton.jsx    # Push-to-talk mic & instant parsing spinner
│       │   │   ├── TradeCard.jsx    # Human-in-the-loop card with APMC net payout
│       │   │   └── TradeLedger.jsx  # Live ledger table, Chit modal & WhatsApp share
│       │   ├── utils/
│       │   │   ├── apmcFees.js      # Hamali & cess calculation + WhatsApp formatter
│       │   │   ├── i18n.js          # Multi-lingual localization strings (5 languages)
│       │   │   ├── offlineDb.js     # Native IndexedDB wrapper & auto-sync logic
│       │   │   └── tts.js           # Regional voice synthesis engine
│       │   ├── App.jsx              # Main dashboard with header language selector
│       │   └── main.tsx             # React entry point
│       ├── index.html         # PWA HTML shell with favicon configuration
│       └── vite.config.ts     # Vite build settings
├── .gitignore                 # Production ignore rules
└── README.md                  # System documentation
```

---

## 📊 Benchmark & Evaluation Suite

MandiVoice includes a standalone automated evaluation script ([eval/benchmark_eval.py](eval/benchmark_eval.py)) testing 12 diverse Hindi, Telugu, Marathi, and Hinglish mandi trade dialogues spanning multiple commodities and non-metric unit conversions.

To run the evaluation:
```bash
python eval/benchmark_eval.py
```

### Evaluation Output:
```text
======================================================================================
  MANDIVOICE BENCHMARK EVALUATION SUITE  (Module 5)
  Testing: Speech Entity Extraction | Metric Fidelity | APMC MSP Compliance
======================================================================================
#   | Commodity | Kg (Std)   | Total (INR)  | Below MSP  | Latency  | Status
--------------------------------------------------------------------------------------
1   | wheat     | 1000.0     | INR 23000    | True       |   30.6ms | PASS
2   | chana     | 5000.0     | INR 290000   | False      |    5.6ms | PASS
3   | mustard   | 400.0      | INR 24800    | False      |    6.5ms | PASS
4   | paddy     | 5000.0     | INR 105000   | True       |    4.8ms | PASS
5   | soybean   | 1500.0     | INR 67500    | True       |    4.5ms | PASS
6   | cotton    | 1600.0     | INR 120000   | False      |    6.3ms | PASS
7   | wheat     | 40.0       | INR 1000     | False      |    4.6ms | PASS
8   | mustard   | 2500.0     | INR 140000   | True       |    4.7ms | PASS
9   | paddy     | 20000.0    | INR 480000   | False      |    4.6ms | PASS
10  | chana     | 1500.0     | INR 81000    | True       |    3.9ms | PASS
11  | soybean   | 1000.0     | INR 51000    | False      |    3.5ms | PASS
12  | cotton    | 1000.0     | INR 68000    | True       |    3.6ms | PASS
--------------------------------------------------------------------------------------

======================================================================================
  AGGREGATE BENCHMARK PERFORMANCE REPORT
======================================================================================
  • Total Benchmark Test Cases : 12
  • Entity Extraction Accuracy  : 100.0% (12/12)
  • Math & Weight Fidelity     : 100.0% (12/12)
  • MSP Benchmark Alert Accuracy: 100.0% (12/12)
  • Overall Pipeline Pass Rate : 100.0%
  • Average Request Latency    : 6.93 ms
======================================================================================
```

---

## ⚡ Quick Start & Installation

### Prerequisites
- **Python 3.10+** (Python 3.12 recommended)
- **Node.js 18+** & **npm**

### 1. Clone the Repository
```bash
git clone https://github.com/dnyanu0909/MandiVoice.git
cd MandiVoice
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
```

*(Optional)* Set your Groq API key for cloud Whisper/LLaMA processing (if not set, the built-in deterministic fallback parser runs automatically):
```bash
# Windows PowerShell
$env:GROQ_API_KEY="your-groq-api-key"

# Linux / macOS
export GROQ_API_KEY="your-groq-api-key"
```

Start the backend API server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
API Documentation will be live at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at: **[http://localhost:3000](http://localhost:3000)**

---

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/transcribe-and-extract` | Accepts audio blob or text transcript; extracts entities, converts metrics, and flags MSP. |
| `POST` | `/api/verify-trade` | Validates an extracted trade object and computes price deviation against MSP. |
| `POST` | `/api/confirm-trade` | Commits verified trade record into SQLite database (`trades.db`). |
| `POST` | `/api/sync-offline` | Batch synchronizes unsynced trades captured in offline IndexedDB mode. |
| `GET`  | `/api/trades` | Retrieves trade history ordered by newest first. |
| `GET`  | `/api/msp-data` | Returns current Government Minimum Support Price benchmarks. |

---

## 🛡️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
<b>MandiVoice • APMC Smart Voice Trading & Ledger</b><br>
<i>Empowering Indian Farmers & Mandi Traders with Voice AI & Price Transparency</i>
</div>
