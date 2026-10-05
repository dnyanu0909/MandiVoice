import json
import os
from datetime import datetime
from typing import Generator, List, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

try:
    from backend.extractor import extract_trade_from_text, transcribe_audio
except ImportError:
    from extractor import extract_trade_from_text, transcribe_audio

app = FastAPI(title="MandiVoice Trade Extraction & Validation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQLite Database Setup via SQLAlchemy (handles local and Vercel serverless writable /tmp)
import tempfile
db_dir = tempfile.gettempdir() if os.environ.get("VERCEL") else os.path.dirname(__file__)
db_path = os.path.join(db_dir, "trades.db")
DATABASE_URL = f"sqlite:///{db_path}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    buyer_name = Column(String, default="Unknown")
    seller_name = Column(String, default="Unknown")
    commodity = Column(String, nullable=False)
    raw_quantity = Column(Float, nullable=False)
    raw_unit = Column(String, nullable=False)
    standard_quantity_kg = Column(Float, nullable=False)
    negotiated_rate = Column(Float, nullable=False)
    rate_unit = Column(String, nullable=False)
    total_amount_inr = Column(Float, nullable=False)
    confidence_score = Column(Float, default=1.0)
    below_msp = Column(Boolean, default=False)
    diff_percentage = Column(Float, default=0.0)
    benchmark_msp = Column(Float, default=0.0, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# Auto-migrate benchmark_msp column if table already exists in SQLite
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE trades ADD COLUMN benchmark_msp FLOAT DEFAULT 0.0"))
        conn.commit()
except Exception:
    pass

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Load MSP Reference Data
MSP_FILE_PATH = os.path.join(os.path.dirname(__file__), "msp_data.json")
if not os.path.exists(MSP_FILE_PATH):
    MSP_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "msp_data.json")
with open(MSP_FILE_PATH, "r", encoding="utf-8") as f:
    MSP_DATA = json.load(f)

UNIT_MULTIPLIERS = {
    "bori": 50.0,
    "quintal": 100.0,
    "mann": 40.0,
    "dharhi": 5.0,
    "kg": 1.0,
}


class TradeExtraction(BaseModel):
    buyer_name: Optional[str] = "Unknown"
    seller_name: Optional[str] = "Unknown"
    commodity: str
    raw_quantity: float
    raw_unit: str
    standard_quantity_kg: Optional[float] = None
    negotiated_rate: float
    rate_unit: str
    total_amount_inr: Optional[float] = None
    confidence_score: Optional[float] = 1.0
    benchmark_msp: Optional[float] = None


def normalize_and_validate(trade: TradeExtraction) -> tuple[bool, float]:
    """Overrides and strictly enforces mathematical conversions and checks against MSP."""
    unit_key = trade.raw_unit.strip().lower()
    multiplier = UNIT_MULTIPLIERS.get(unit_key)
    if multiplier is None:
        raise ValueError(f"Unsupported unit '{trade.raw_unit}'. Supported: {list(UNIT_MULTIPLIERS.keys())}")

    # Calculate standard_quantity_kg = raw_quantity * multiplier
    trade.standard_quantity_kg = round(trade.raw_quantity * multiplier, 2)

    # Calculate total_amount_inr
    rate_u = trade.rate_unit.strip().lower()
    if rate_u == "per_quintal":
        trade.total_amount_inr = round((trade.standard_quantity_kg / 100.0) * trade.negotiated_rate, 2)
        effective_price_per_quintal = trade.negotiated_rate
    elif rate_u == "per_kg":
        trade.total_amount_inr = round(trade.standard_quantity_kg * trade.negotiated_rate, 2)
        effective_price_per_quintal = trade.negotiated_rate * 100.0
    else:
        raise ValueError(f"Unsupported rate_unit '{trade.rate_unit}'. Supported: 'per_quintal', 'per_kg'")

    # Check against benchmark_msp or fallback to msp_data.json
    if trade.benchmark_msp is not None and float(trade.benchmark_msp) > 0:
        msp_per_quintal = float(trade.benchmark_msp)
    else:
        comm = trade.commodity.strip().lower()
        msp_entry = MSP_DATA.get(comm)
        if not msp_entry:
            alias_map = {"paddy_common": "paddy", "cotton_medium": "cotton"}
            msp_entry = MSP_DATA.get(alias_map.get(comm))

        msp_per_quintal = 0.0
        if isinstance(msp_entry, dict):
            msp_per_quintal = float(msp_entry.get("msp_per_quintal", 0.0))
        elif isinstance(msp_entry, (int, float)):
            msp_per_quintal = float(msp_entry)
        trade.benchmark_msp = msp_per_quintal

    if msp_per_quintal > 0:
        below_msp = effective_price_per_quintal < msp_per_quintal
        diff_percentage = round(((effective_price_per_quintal - msp_per_quintal) / msp_per_quintal) * 100.0, 2)
    else:
        below_msp, diff_percentage = False, 0.0

    return below_msp, diff_percentage


api_router = APIRouter()


@api_router.post("/transcribe-and-extract")
async def transcribe_and_extract(
    transcript: Optional[str] = Form(None),
    audio: Optional[UploadFile] = File(None),
):
    raw_text = transcript or ""
    if audio is not None:
        audio_bytes = await audio.read()
        raw_text = transcribe_audio(audio_bytes, audio.filename or "audio.wav")

    if not raw_text or not raw_text.strip():
        raise HTTPException(status_code=400, detail="Either audio or transcript must be provided.")

    extracted_dict = extract_trade_from_text(raw_text)
    filtered = {k: v for k, v in extracted_dict.items() if k in TradeExtraction.model_fields}
    trade = TradeExtraction(**filtered)
    below_msp, diff_percentage = normalize_and_validate(trade)

    trade_payload = trade.model_dump()
    trade_payload["below_msp"] = below_msp
    trade_payload["diff_percentage"] = diff_percentage

    return {
        "transcript": raw_text,
        "trade": trade_payload,
    }


@api_router.post("/verify-trade")
def verify_trade(trade: TradeExtraction):
    try:
        below_msp, diff_percentage = normalize_and_validate(trade)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    result = trade.model_dump()
    result["below_msp"] = below_msp
    result["diff_percentage"] = diff_percentage
    result["trade"] = trade.model_dump()
    return result


@api_router.post("/confirm-trade")
def confirm_trade(trade: TradeExtraction, db: Session = Depends(get_db)):
    try:
        below_msp, diff_percentage = normalize_and_validate(trade)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db_trade = Trade(
        buyer_name=trade.buyer_name or "Unknown",
        seller_name=trade.seller_name or "Unknown",
        commodity=trade.commodity,
        raw_quantity=trade.raw_quantity,
        raw_unit=trade.raw_unit,
        standard_quantity_kg=trade.standard_quantity_kg,
        negotiated_rate=trade.negotiated_rate,
        rate_unit=trade.rate_unit,
        total_amount_inr=trade.total_amount_inr,
        confidence_score=trade.confidence_score if trade.confidence_score is not None else 1.0,
        below_msp=below_msp,
        diff_percentage=diff_percentage,
        benchmark_msp=trade.benchmark_msp or 0.0,
    )
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)

    return {
        "status": "CONFIRMED",
        "trade_id": db_trade.id,
        "trade": trade.model_dump(),
        "below_msp": below_msp,
        "diff_percentage": diff_percentage,
        "benchmark_msp": db_trade.benchmark_msp,
    }


@api_router.post("/sync-offline")
def sync_offline(trades: List[TradeExtraction], db: Session = Depends(get_db)):
    synced_ids = []
    for trade in trades:
        try:
            below_msp, diff_percentage = normalize_and_validate(trade)
        except Exception:
            below_msp, diff_percentage = False, 0.0
        db_trade = Trade(
            buyer_name=trade.buyer_name or "Unknown",
            seller_name=trade.seller_name or "Unknown",
            commodity=trade.commodity,
            raw_quantity=trade.raw_quantity,
            raw_unit=trade.raw_unit,
            standard_quantity_kg=trade.standard_quantity_kg or 0.0,
            negotiated_rate=trade.negotiated_rate or 0.0,
            rate_unit=trade.rate_unit or "per_quintal",
            total_amount_inr=trade.total_amount_inr or 0.0,
            confidence_score=trade.confidence_score if trade.confidence_score is not None else 1.0,
            below_msp=below_msp,
            diff_percentage=diff_percentage,
            benchmark_msp=trade.benchmark_msp or 0.0,
        )
        db.add(db_trade)
        db.commit()
        db.refresh(db_trade)
        synced_ids.append(db_trade.id)

    return {
        "synced_count": len(trades),
        "status": "success",
        "synced_ids": synced_ids,
    }


@api_router.get("/trades")
def list_trades(db: Session = Depends(get_db)):
    return db.query(Trade).order_by(Trade.created_at.desc()).all()


@api_router.get("/msp-data")
def get_msp_data():
    return MSP_DATA


# Include trade API routes under both /api and root to guarantee 0 routing mismatch
app.include_router(api_router, prefix="/api")
app.include_router(api_router)


@app.get("/api")
@app.get("/api/")
def health_check():
    return {
        "status": "online",
        "service": "MandiVoice Trade Extraction & Validation API",
        "version": "1.0.0",
        "endpoints": [
            "/api/transcribe-and-extract",
            "/api/confirm-trade",
            "/api/sync-offline",
            "/api/trades",
            "/api/msp-data"
        ]
    }

# Frontend dist folder path (supports running from repo root or backend/)
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend", "dist"))

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def serve_root():
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return health_check()

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path in ("docs", "redoc", "openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")

        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)

        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend file not found")
else:
    @app.get("/")
    def serve_fallback_root():
        return health_check()

