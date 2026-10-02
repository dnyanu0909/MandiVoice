const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function transcribeAndExtractApi(
  transcript?: string,
  audioBlob?: Blob,
  filename = 'audio.wav'
) {
  const formData = new FormData();
  if (transcript) formData.append('transcript', transcript);
  if (audioBlob) formData.append('audio', audioBlob, filename);

  try {
    const res = await fetch('/api/transcribe-and-extract', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback to explicit base URL
  }

  const res = await fetch(${API_BASE}/api/transcribe-and-extract, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(Extraction failed: );
  }
  return await res.json();
}

export async function verifyTradeApi(trade: any) {
  try {
    const res = await fetch('/api/verify-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    });
    if (res.ok) return await res.json();
  } catch {}

  const res = await fetch(${API_BASE}/api/verify-trade, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trade),
  });
  if (!res.ok) throw new Error('Verification failed');
  return await res.json();
}

export async function confirmTradeApi(trade: any) {
  try {
    const res = await fetch('/api/confirm-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    });
    if (res.ok) return await res.json();
  } catch {}

  const res = await fetch(${API_BASE}/api/confirm-trade, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trade),
  });
  if (!res.ok) throw new Error('Confirmation failed');
  return await res.json();
}

export async function fetchTradesApi() {
  try {
    const res = await fetch('/api/trades');
    if (res.ok) return await res.json();
  } catch {}

  try {
    const res = await fetch(${API_BASE}/api/trades);
    if (res.ok) return await res.json();
  } catch {}
  return [];
}
