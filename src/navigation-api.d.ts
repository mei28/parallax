// The Navigation API, which TypeScript's DOM library does not declare yet.
//
// Chrome has shipped it since 102, comfortably below the 138 parallax already requires for
// the Translator API. Only the one event is declared, because only the one is used: a pane
// finishing a navigation that never reloaded its frame.
interface NavigationApi extends EventTarget {
  addEventListener(
    type: "navigatesuccess",
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: "navigatesuccess",
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface Window {
  readonly navigation?: NavigationApi;
}
