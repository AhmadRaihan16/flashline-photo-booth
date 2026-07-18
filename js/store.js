/**
 * store.js
 * ---------------------------------------------------------------------------
 * A minimal, dependency-free reactive store. No framework named "Antigravity"
 * exists as an installable package, so this module implements the same idea
 * from scratch: a Proxy-wrapped state object that notifies subscribers on
 * every mutation, giving you predictable, one-directional data flow without
 * pulling in Vue/React/Alpine.
 *
 * Usage:
 *   const store = createStore({ count: 0 });
 *   store.subscribe((key, value, state) => render(state));
 *   store.state.count++; // triggers subscribers
 */

export function createStore(initialState) {
  const listeners = new Set();
  let batching = false;
  let pendingNotify = false;

  const notify = (key, value, target) => {
    if (batching) {
      pendingNotify = true;
      return;
    }
    listeners.forEach((fn) => fn(key, value, target));
  };

  const state = new Proxy({ ...initialState }, {
    set(target, key, value) {
      const changed = target[key] !== value;
      target[key] = value;
      if (changed) notify(key, value, target);
      return true;
    },
    deleteProperty(target, key) {
      delete target[key];
      notify(key, undefined, target);
      return true;
    },
  });

  return {
    state,

    /** Subscribe to any state change. Returns an unsubscribe function. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /**
     * Apply several mutations as one notification, so the UI doesn't
     * re-render N times for N property writes in the same tick.
     */
    batch(mutator) {
      batching = true;
      try {
        mutator(state);
      } finally {
        batching = false;
        if (pendingNotify) {
          pendingNotify = false;
          listeners.forEach((fn) => fn('*', null, state));
        }
      }
    },
  };
}
