const DEFAULT_TIMEOUT = 5000;

export async function getPortfolioContent({ signal, timeout = DEFAULT_TIMEOUT } = {}) {
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort(), timeout);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch("/api/content", {
      headers: { Accept: "application/json" },
      signal: combinedSignal,
    });

    if (!response.ok) {
      throw new Error(`Portfolio API returned ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}
