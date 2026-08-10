// Service worker entry point.
// Owns preferences and content-script injection only. The Translator API is unavailable in
// worker contexts, so all translation work lives in src/content/.
export {};
