// Smart API Base URL resolver for MandiVoice
// Seamlessly handles local development, Vercel Serverless monorepo, and stale environment variable fallbacks

export function getApiBase() {
  const rawEnv =
    (import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.trim()) ||
    (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) ||
    '';

  const envUrl = rawEnv.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    // When running in production (on Vercel, cloud, or mobile browser)
    if (!isLocalhost) {
      // 1. Never try calling localhost:8000 from a live public web browser (avoids mixed content & connection failure)
      if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        return '';
      }

      // 2. Never call a stale/different Vercel deployment URL (e.g. old mandi-voice-three) when running on current domain
      if (envUrl.includes('.vercel.app') && !envUrl.includes(window.location.hostname)) {
        return '';
      }
    }
  }

  return envUrl;
}

export default getApiBase;
