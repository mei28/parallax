// The split overlay: one element added to the page, and everything parallax shows lives
// inside it.
//
// Three choices here are load-bearing.
//
// A closed shadow root, so the page's `iframe {}` and `* { box-sizing }` rules cannot reach
// the overlay and the overlay's rules cannot reach the page.
//
// <dialog> with showModal(), so the overlay sits in the top layer. That beats any z-index,
// including a site's 2147483647 fixed header, and it beats another element that has put
// itself in the top layer — which a plain `position: fixed` overlay would not. It also makes
// the rest of the document inert and gives Esc-to-close for free.
//
// The page itself is left standing. The only edits to the host document are the one appended
// element and documentElement's inline overflow, so teardown restores rather than reloads,
// and the reader's scroll position, form input and media playback all survive the split.
import {
  ATTR_CARD,
  ATTR_CONTAINER,
  ATTR_DIALOG,
  ATTR_FRAME,
  ATTR_GRIP,
  ATTR_HANDLE,
  ATTR_HOST,
  ATTR_MESSAGE,
  ATTR_MODE,
  ATTR_ORIENTATION,
  ATTR_PANE,
  ATTR_PROGRESS,
  ATTR_STATUS,
  ATTR_TOOLBAR,
  CSS_VAR_PROGRESS,
  CSS_VAR_RATIO,
} from "../shared/constants.ts";
import type { Orientation, PaneId, SplitMode, ToolbarStatus } from "../shared/types.ts";
import styles from "./overlay.css";

/**
 * Frame sandbox.
 *
 * Chrome warns that an iframe with both allow-scripts and allow-same-origin "can escape its
 * sandboxing", and it is right: this is not a security boundary and is not meant to be.
 * `allow-same-origin` is what the whole design rests on — without it the panes would be
 * opaque and neither translation nor scroll sync could reach them.
 *
 * The one thing the attribute buys is what it withholds. Without `allow-top-navigation`, a
 * frame-busting site's `top.location = self.location` throws inside its own frame instead of
 * navigating the tab out from under the reader.
 */
const FRAME_SANDBOX = "allow-same-origin allow-scripts allow-forms allow-popups";

export interface OverlayOptions {
  /** Both panes load this. It is the page the reader is already on. */
  readonly url: string;
}

export interface Overlay {
  readonly container: HTMLElement;
  readonly handle: HTMLElement;
  readonly panes: Readonly<Record<PaneId, HTMLElement>>;
  readonly frames: Readonly<Record<PaneId, HTMLIFrameElement>>;
  setRatio(ratio: number): void;
  setOrientation(orientation: Orientation): void;
  setMode(mode: SplitMode): void;
  /** Preview which pane a release would remove, or clear the preview with null. */
  setCollapsing(pane: PaneId | null): void;
  setStatus(status: ToolbarStatus, message: string): void;
  setProgress(fraction: number): void;
  /**
   * Cover the panes with a message. With an action it is a prompt the reader can answer —
   * the click also supplies the transient activation Chrome wants before downloading a
   * language pack. Without one it is a wall the split cannot continue past.
   */
  showCard(message: string, action?: { label: string; onClick: () => void }): void;
  hideCard(): void;
  /** Fires when the reader presses Esc, which <dialog> reports as `cancel`. */
  onRequestClose(handler: () => void): void;
  destroy(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attributes: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

function createPane(doc: Document, pane: PaneId, url: string, title: string) {
  const container = element(doc, "div", { [ATTR_PANE]: pane });
  const frame = element(doc, "iframe", {
    [ATTR_FRAME]: pane,
    src: url,
    title,
    sandbox: FRAME_SANDBOX,
    // Both panes are the page the reader already has open, so nothing is being prefetched
    // that they did not already ask for.
    referrerpolicy: "no-referrer-when-downgrade",
  });
  container.append(frame);
  return { container, frame };
}

export function createOverlay(doc: Document, options: OverlayOptions): Overlay {
  const root = doc.documentElement;
  const previousOverflow = root.style.overflow;
  const previousScroll = { x: doc.defaultView?.scrollX ?? 0, y: doc.defaultView?.scrollY ?? 0 };

  const host = element(doc, "div", { [ATTR_HOST]: "" });
  const shadow = host.attachShadow({ mode: "closed" });

  const style = doc.createElement("style");
  style.textContent = styles;

  const dialog = element(doc, "dialog", { [ATTR_DIALOG]: "" });
  const container = element(doc, "div", {
    [ATTR_CONTAINER]: "",
    [ATTR_ORIENTATION]: "horizontal",
    [ATTR_MODE]: "split",
  });

  const source = createPane(doc, "source", options.url, "Original");
  const target = createPane(doc, "target", options.url, "Translation");
  const handle = element(doc, "button", {
    [ATTR_HANDLE]: "",
    type: "button",
    role: "separator",
    "aria-label": "Resize the split",
    title: "Drag to resize, or use the arrow keys",
  });
  // The grip is drawn entirely in CSS. Sites that enable Trusted Types — GitHub among them —
  // make innerHTML throw, so an inline SVG string is not an option here.
  handle.append(element(doc, "span", { [ATTR_GRIP]: "", "aria-hidden": "true" }));

  const toolbar = element(doc, "div", { [ATTR_TOOLBAR]: "", [ATTR_STATUS]: "idle" });
  const message = element(doc, "span", { [ATTR_MESSAGE]: "", role: "status" });
  const progress = element(doc, "div", { [ATTR_PROGRESS]: "" });
  const card = element(doc, "div", { [ATTR_CARD]: "", hidden: "" });

  container.append(source.container, handle, target.container);
  toolbar.append(message, progress);
  dialog.append(container, toolbar, card);
  shadow.append(style, dialog);
  root.append(host);

  root.style.overflow = "hidden";
  // jsdom implements showModal; a browser that did not would leave the overlay behind the
  // page rather than in the top layer, which is why this is not guarded away.
  dialog.showModal();

  let destroyed = false;

  return {
    container,
    handle,
    panes: { source: source.container, target: target.container },
    frames: { source: source.frame, target: target.frame },

    setRatio(ratio) {
      container.style.setProperty(CSS_VAR_RATIO, String(ratio));
    },

    setOrientation(orientation) {
      container.setAttribute(ATTR_ORIENTATION, orientation);
    },

    setMode(mode) {
      container.setAttribute(ATTR_MODE, mode);
    },

    setCollapsing(pane) {
      for (const [id, node] of Object.entries({
        source: source.container,
        target: target.container,
      })) {
        node.toggleAttribute("data-parallax-collapsing", id === pane);
      }
    },

    setStatus(status, text) {
      toolbar.setAttribute(ATTR_STATUS, status);
      message.textContent = text;
    },

    setProgress(fraction) {
      progress.style.setProperty(CSS_VAR_PROGRESS, String(fraction));
    },

    showCard(text, action) {
      const paragraph = doc.createElement("p");
      paragraph.textContent = text;
      card.replaceChildren(paragraph);
      if (action !== undefined) {
        const button = element(doc, "button", { type: "button" });
        button.textContent = action.label;
        button.addEventListener("click", action.onClick);
        card.append(button);
      }
      card.hidden = false;
      container.setAttribute(ATTR_MODE, "error");
    },

    hideCard() {
      card.hidden = true;
      card.replaceChildren();
      container.setAttribute(ATTR_MODE, "split");
    },

    onRequestClose(handler) {
      dialog.addEventListener("cancel", (event) => {
        // Without this the dialog closes itself and leaves the host element behind.
        event.preventDefault();
        handler();
      });
    },

    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      dialog.close();
      host.remove();
      // Restore verbatim, including the empty string, so a page that had no inline overflow
      // ends with no inline style attribute rather than `overflow: visible`.
      root.style.overflow = previousOverflow;
      if (root.getAttribute("style") === "") {
        root.removeAttribute("style");
      }
      doc.defaultView?.scrollTo(previousScroll.x, previousScroll.y);
    },
  };
}
