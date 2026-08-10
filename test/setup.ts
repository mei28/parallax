// Chrome API mock for the test environment.
// Translator and LanguageDetector are deliberately NOT mocked: any accidental use of the
// on-device translation APIs in a unit test should fail loudly rather than pass silently.
const noop = () => {};

const storageMock = {
  get: (_keys: unknown, callback?: (items: Record<string, unknown>) => void) => {
    callback?.({});
    return Promise.resolve({});
  },
  set: (_items: unknown, callback?: () => void) => {
    callback?.();
    return Promise.resolve();
  },
};

const chromeMock = {
  storage: {
    local: storageMock,
    sync: storageMock,
    onChanged: { addListener: noop, removeListener: noop },
  },
  runtime: {
    sendMessage: noop,
    onMessage: { addListener: noop, removeListener: noop },
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
  tabs: {
    query: (_query: unknown, callback?: (tabs: unknown[]) => void) => {
      callback?.([]);
      return Promise.resolve([]);
    },
    sendMessage: noop,
  },
  scripting: {
    executeScript: () => Promise.resolve([]),
  },
  commands: {
    onCommand: { addListener: noop, removeListener: noop },
  },
};

Object.defineProperty(globalThis, "chrome", { value: chromeMock, writable: true });
