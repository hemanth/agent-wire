/**
 * Official OpenRouter PKCE Authentication Module
 * Reference: https://github.com/OpenRouterTeam/sign-in-with-openrouter
 */

const STORAGE_KEY = 'openrouter_key';
const VERIFIER_KEY = 'openrouter_code_verifier';
const STATE_KEY = 'openrouter_oauth_state';

export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY) || localStorage.getItem('openrouter_api_key');
  } catch {
    return null;
  }
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, key);
    localStorage.removeItem('openrouter_api_key');
  } catch {
    // Ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent('openrouter-auth-changed', { detail: { connected: true } }));
}

export function clearStoredApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('openrouter_api_key');
  } catch {
    // Ignore storage errors
  }
  window.dispatchEvent(new CustomEvent('openrouter-auth-changed', { detail: { connected: false } }));
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
 * Start the OpenRouter OAuth PKCE authorization flow with CSRF state protection.
 */
export async function initiateOAuth(callbackUrl?: string): Promise<void> {
  const verifier = generateCodeVerifier();
  const oauthState = generateCodeVerifier().slice(0, 24);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, oauthState);

  const challenge = await computeS256Challenge(verifier);
  const baseCallback = callbackUrl ?? window.location.origin + window.location.pathname;
  const cbUrl = new URL(baseCallback, window.location.origin);
  cbUrl.searchParams.set('state', oauthState);

  const params = new URLSearchParams({
    callback_url: cbUrl.toString(),
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://openrouter.ai/auth?${params.toString()}`;
}

/**
 * Exchange the OAuth code for an OpenRouter API key.
 * Tries direct OpenRouter exchange, with backend proxy fallback.
 */
export async function exchangeOAuthCode(code: string, returnedState?: string | null): Promise<string> {
  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (expectedState && returnedState !== expectedState) {
    sessionStorage.removeItem(VERIFIER_KEY);
    localStorage.removeItem(VERIFIER_KEY);
    throw new Error('OAuth state mismatch (CSRF check failed). Please try signing in again.');
  }

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
      try {
        JSON.parse(errText);
      } catch {
        // Fallback to edge worker proxy below
      }
    }
  } catch {
    // Fallback to edge worker proxy below
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
