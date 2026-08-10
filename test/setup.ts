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

// jsdom has no top layer, so its <dialog> lacks showModal/close. Chrome 138+ — the only
// browser parallax targets — implements both, and the overlay depends on the top layer to
// sit above a site's own fixed elements. Stubbing the two methods keeps the overlay tests
// about the overlay rather than about jsdom's gaps.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    this.removeAttribute("open");
  };
}
