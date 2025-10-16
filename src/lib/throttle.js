/**
 * Throttle utility for WebSocket events
 * Prevents excessive function calls during rapid WebSocket events
 */

export function throttle(func, delay = 1000) {
  let timeoutId = null;
  let lastExecuted = 0;

  return function (...args) {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted;

    if (timeSinceLastExecution >= delay) {
      func.apply(this, args);
      lastExecuted = now;
    } else {
      // Queue the call for later
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecuted = Date.now();
        timeoutId = null;
      }, delay - timeSinceLastExecution);
    }
  };
}

/**
 * Debounce utility - waits for a pause in events before executing
 * Useful for batching multiple rapid events
 */
export function debounce(func, delay = 500) {
  let timeoutId = null;

  return function (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Batch updates - collects multiple updates and processes them together
 */
export class BatchProcessor {
  constructor(processFn, delay = 500, maxBatchSize = 10) {
    this.processFn = processFn;
    this.delay = delay;
    this.maxBatchSize = maxBatchSize;
    this.batch = [];
    this.timeoutId = null;
  }

  add(item) {
    this.batch.push(item);

    // Process immediately if batch is full
    if (this.batch.length >= this.maxBatchSize) {
      this.flush();
      return;
    }

    // Otherwise, schedule processing
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.delay);
  }

  flush() {
    if (this.batch.length === 0) return;

    const itemsToProcess = [...this.batch];
    this.batch = [];

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.processFn(itemsToProcess);
  }

  clear() {
    this.batch = [];
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
