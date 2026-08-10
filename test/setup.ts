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
  // Echoes the key rather than the copy. Tests assert on which failure was reported, never
  // on its wording — that belongs to test/shared/errors.test.ts and the locale catalogues.
  i18n: {
    getMessage: (key: string, substitutions?: string[]) =>
      substitutions === undefined || substitutions.length === 0
        ? key
        : `${key}(${substitutions.join(",")})`,
  },
};

Object.defineProperty(globalThis, "chrome", { value: chromeMock, writable: true });

// jsdom has no top layer, so its <dialog> lacks showModal/close. Chrome 138+ — the only
// browser parallax targets — implements both, and the overlay depends on the top layer to
// sit above a site's own fixed elements. Stubbing the two methods keeps the overlay tests
// about the overlay rather than about jsdom's gaps.
// jsdom implements no IntersectionObserver at all. The controller builds one inside a pane's
// own realm to translate what is on screen first, so without this the split cannot even be
// constructed under test.
if (typeof window !== "undefined" && window.IntersectionObserver === undefined) {
  class StubIntersectionObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] {
      return [];
    }
  }
  Object.defineProperty(window, "IntersectionObserver", {
    value: StubIntersectionObserver,
    writable: true,
  });
}

if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    this.removeAttribute("open");
  };
}
