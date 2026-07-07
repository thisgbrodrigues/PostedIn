import { z } from 'zod';

export const brandbookInputSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1),
  industry: z.string().min(1),
  bio: z.string().default(''),
  values: z.string().default(''),
  voiceReferences: z.string().default(''),
});

export type BrandbookInput = z.infer<typeof brandbookInputSchema>;
