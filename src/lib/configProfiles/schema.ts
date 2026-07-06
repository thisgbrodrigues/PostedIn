import { z } from 'zod';

// Zod v4's `z.record()` requires an explicit key schema as its first
// argument (the single-argument, implicit-string-key form from v3 was
// removed) — hence `z.string()` below rather than a bare value schema.
export const configProfileInputSchema = z.object({
  name: z.string().min(1),
  toneOfVoice: z.record(z.string(), z.unknown()).default({}),
  objective: z.string().min(1),
  niche: z.string().min(1),
  template: z.record(z.string(), z.unknown()).default({}),
  modelOverrides: z.record(z.string(), z.string().min(1)).default({}),
});

export type ConfigProfileInput = z.infer<typeof configProfileInputSchema>;
