import { describe, it, expect } from 'vitest';
import { configProfileInputSchema } from './schema';

describe('configProfileInputSchema', () => {
  it('accepts a minimal valid profile and fills in defaults', () => {
    const result = configProfileInputSchema.parse({
      name: 'Devops Voice',
      objective: 'gerar autoridade',
      niche: 'devops',
    });

    expect(result.toneOfVoice).toEqual({});
    expect(result.template).toEqual({});
    expect(result.modelOverrides).toEqual({});
  });

  it('rejects a profile missing required fields', () => {
    const result = configProfileInputSchema.safeParse({ name: 'Devops Voice' });

    expect(result.success).toBe(false);
  });
});
