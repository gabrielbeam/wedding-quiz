const DEFAULT_API_BASE_URL = 'https://wedding-quiz-backend-production.up.railway.app';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function verifyHostPassword(password) {
  return request('/verify-host-password', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export async function startQuiz(password) {
  return request('/start-quiz', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export async function resetGame(password) {
  return request('/reset-game', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export async function endGame(password) {
  return request('/end-game', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export async function fetchGameState() {
  return request('/game-state');
}
