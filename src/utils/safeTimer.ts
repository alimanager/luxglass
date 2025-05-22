// Utility function for safe timer usage across environments
export const safeSetTimeout = (callback: () => void, delay: number): number | NodeJS.Timeout => {
  if (typeof window !== 'undefined') {
    return window.setTimeout(callback, delay);
  }
  return setTimeout(callback, delay);
};

export const safeClearTimeout = (timeoutId: number | NodeJS.Timeout): void => {
  if (typeof window !== 'undefined') {
    window.clearTimeout(timeoutId as number);
  } else {
    clearTimeout(timeoutId);
  }
};

export const createSafeTimer = (callback: () => void, delay: number) => {
  let timeoutId: number | NodeJS.Timeout;
  
  const start = () => {
    timeoutId = safeSetTimeout(callback, delay);
  };
  
  const stop = () => {
    if (timeoutId) {
      safeClearTimeout(timeoutId);
    }
  };
  
  return { start, stop };
};