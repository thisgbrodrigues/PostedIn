import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// apiKey is intentionally possibly undefined here — createOpenRouter's own
// loadApiKey falls back to reading OPENROUTER_API_KEY itself and throws a
// clear "OpenRouter API key is missing" error at call time if it's unset.
// Don't coerce to '' — that skips the fallback and turns a missing key into
// an opaque 401 instead of that clear error.
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});
