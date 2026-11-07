// Calling Sarashina from the service worker.
//
// The worker makes the request for two reasons. Its fetch comes from the extension's origin,
// where the host permission for api.sarashina.ai lets it past CORS — the service sends no
// Access-Control-Allow-Origin. And the key stays in the worker: the content script never
// holds it, so the page's renderer never does either.
import type { ParallaxFailure } from "../shared/errors.ts";
import type { SarashinaOutcome } from "../shared/sarashina.ts";
import {
  failureForFetchError,
  interpretResponse,
  requestBody,
  SARASHINA_ENDPOINT,
  SARASHINA_ORIGIN_PATTERN,
  SARASHINA_TIMEOUT_MS,
} from "../shared/sarashina.ts";
import type { LanguagePair } from "../shared/types.ts";
import { loadApiKey } from "./storage.ts";

/** The key to send with, or what is missing before a request could be made. */
async function credentials(): Promise<
  { readonly key: string } | { readonly failure: ParallaxFailure }
> {
  const key = await loadApiKey();
  if (key === null) {
    return { failure: { code: "API_KEY_MISSING" } };
  }
  if (!(await chrome.permissions.contains({ origins: [SARASHINA_ORIGIN_PATTERN] }))) {
    return { failure: { code: "API_PERMISSION_MISSING" } };
  }
  return { key };
}

/** null when a key is saved and the service may be reached; otherwise what is missing. */
export async function checkSarashinaReady(): Promise<ParallaxFailure | null> {
  const found = await credentials();
  return "failure" in found ? found.failure : null;
}

/** Translate one request's text. Every way it can go wrong comes back named, not thrown. */
export async function translateWithSarashina(
  pair: LanguagePair,
  text: string,
): Promise<SarashinaOutcome> {
  const found = await credentials();
  if ("failure" in found) {
    return { kind: "failed", failure: found.failure };
  }
  let response: Response;
  let body: string;
  try {
    response = await fetch(SARASHINA_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${found.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody(pair, text)),
      signal: AbortSignal.timeout(SARASHINA_TIMEOUT_MS),
    });
    body = await response.text();
  } catch (error) {
    return {
      kind: "failed",
      failure: failureForFetchError(
        error instanceof Error ? error.name : "Error",
        error instanceof Error ? error.message : String(error),
      ),
    };
  }
  return interpretResponse(response.status, body, response.headers.get("Retry-After"));
}
