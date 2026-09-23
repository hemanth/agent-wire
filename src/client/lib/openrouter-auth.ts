/**
 * Official OpenRouter PKCE Authentication Module
 * Reference: https://github.com/OpenRouterTeam/sign-in-with-openrouter
 */

const STORAGE_KEY = 'openrouter_key';
const VERIFIER_KEY = 'openrouter_code_verifier';

export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY) || localStorage.getItem('openrouter_api_key');
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, key);
  localStorage.setItem('openrouter_api_key', key);
  window.dispatchEvent(new CustomEvent('openrouter-auth-changed', { detail: { key } }));
}

export function clearStoredApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('openrouter_api_key');
  window.dispatchEvent(new CustomEvent('openrouter-auth-changed', { detail: { key: null } }));
}

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function computeS256Challenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Start the OpenRouter OAuth PKCE authorization flow.
 */
export async function initiateOAuth(callbackUrl?: string): Promise<void> {
  const verifier = generateCodeVerifier();
  // Store in both sessionStorage and localStorage for resilience across cross-origin redirects/tabs
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(VERIFIER_KEY, verifier);

  const challenge = await computeS256Challenge(verifier);
  const url = callbackUrl ?? window.location.origin + window.location.pathname;

  const params = new URLSearchParams({
    callback_url: url,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://openrouter.ai/auth?${params.toString()}`;
}

/**
 * Exchange the OAuth code for an OpenRouter API key.
 * Tries direct OpenRouter exchange, with backend proxy fallback.
 */
export async function exchangeOAuthCode(code: string): Promise<string> {
  const verifier =
    sessionStorage.getItem(VERIFIER_KEY) || localStorage.getItem(VERIFIER_KEY);

  if (!verifier) {
    throw new Error('Missing code verifier. The OAuth session may have expired or was opened in another tab.');
  }

  // Clean up verifiers
  sessionStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(VERIFIER_KEY);

  const payload = {
    code,
    code_verifier: verifier,
    code_challenge_method: 'S256',
  };

  // 1. Try direct exchange with OpenRouter (has CORS enabled)
  try {
    const directRes = await fetch('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (directRes.ok) {
      const data = await directRes.json();
      if (data.key) {
        setStoredApiKey(data.key);
        return data.key;
      }
    } else {
      const errText = await directRes.text();
      let parsedErr: any = null;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        // ignore
      }
      const message = parsedErr?.error?.message || parsedErr?.error || `Direct exchange returned ${directRes.status}: ${errText}`;
      console.warn('Direct OpenRouter exchange failed, trying proxy:', message);
    }
  } catch (directErr) {
    console.warn('Direct OpenRouter fetch error, falling back to proxy:', directErr);
  }

  // 2. Fallback to edge worker proxy
  const proxyRes = await fetch('/api/auth/openrouter-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!proxyRes.ok) {
    const errJson = await proxyRes.json().catch(() => ({}));
    const message = errJson.error?.message || errJson.error || `Proxy key exchange failed (${proxyRes.status})`;
    throw new Error(message);
  }

  const data = await proxyRes.json();
  if (!data.key) {
    throw new Error(data.error?.message || data.error || 'No API key returned from exchange');
  }

  setStoredApiKey(data.key);
  return data.key;
}
