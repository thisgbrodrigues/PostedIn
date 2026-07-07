import { z } from 'zod';

export const structureExampleInputSchema = z.object({
  filename: z
    .string()
    .min(1)
    .refine((name) => name.endsWith('.md') || name.endsWith('.txt'), {
      message: 'filename must end with .md or .txt',
    }),
  content: z.string().min(1),
});

export type StructureExampleInput = z.infer<typeof structureExampleInputSchema>;
