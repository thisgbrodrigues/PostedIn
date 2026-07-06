import { z } from 'zod';

// z.record() requires an explicit key schema in this project's installed
// Zod version (v4) — v3's single-argument z.record(valueType) overload with
// an implicit string key no longer exists.
const toneOfVoiceSchema = z.record(z.string(), z.unknown());
const templateSchema = z.record(z.string(), z.unknown());
const modelOverridesSchema = z.record(z.string(), z.string().min(1));

// No .default() here on purpose — this base shape backs both schemas below.
// configProfileUpdateSchema.partial() must leave an omitted field genuinely
// absent (undefined) rather than filled in with {}, since a PATCH treats any
// non-undefined field as "set this," and a filled-in default would silently
// overwrite existing data on every partial update.
const configProfileBaseSchema = z.object({
  name: z.string().min(1),
  toneOfVoice: toneOfVoiceSchema,
  objective: z.string().min(1),
  niche: z.string().min(1),
  template: templateSchema,
  modelOverrides: modelOverridesSchema,
});

export const configProfileInputSchema = configProfileBaseSchema.extend({
  toneOfVoice: toneOfVoiceSchema.default({}),
  template: templateSchema.default({}),
  modelOverrides: modelOverridesSchema.default({}),
});

export type ConfigProfileInput = z.infer<typeof configProfileInputSchema>;

export const configProfileUpdateSchema = configProfileBaseSchema.partial();

export type ConfigProfileUpdate = z.infer<typeof configProfileUpdateSchema>;
