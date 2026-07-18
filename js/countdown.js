/**
 * countdown.js
 * ---------------------------------------------------------------------------
 * A promise-based countdown so callers can `await runCountdown(...)` and know
 * a capture is safe to take immediately afterward — no setTimeout races.
 */

/**
 * @param {number} seconds       Starting number (e.g. 3).
 * @param {(n: number) => void} onTick   Called once per second, including 0.
 * @param {() => void} [onBeep]  Fired on every tick above 0 — wire to an
 *                                audio element for a countdown beep.
 * @param {() => void} [onShutter] Fired once, at 0 — wire to a shutter sound.
 * @returns {Promise<void>} resolves right after the "0"/shutter tick.
 */
export function runCountdown(seconds, onTick, onBeep, onShutter) {
  return new Promise((resolve) => {
    let remaining = seconds;
    onTick(remaining);

    const timer = setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        onBeep?.();
        onTick(remaining);
        return;
      }

      clearInterval(timer);
      onShutter?.();
      onTick(0);
      // Small pause so the "0" / flash frame is actually visible before
      // the caller swaps screens or takes the frame.
      setTimeout(resolve, 180);
    }, 1000);
  });
}

/** Simple delay helper used for the pause between burst shots. */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
