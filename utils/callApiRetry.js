/**
 * Retry a call API action so hang-up / cancel / reject still reach the DB
 * when the network blips.
 */
export async function withCallApiRetry(fn, { attempts = 3, delayMs = 400 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}
