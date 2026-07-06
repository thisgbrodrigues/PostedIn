import { describe, it, expect } from 'vitest';
import { configProfileInputSchema, configProfileUpdateSchema } from './schema';

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

  it('rejects empty-string model override values', () => {
    const result = configProfileInputSchema.safeParse({
      name: 'Devops Voice',
      objective: 'gerar autoridade',
      niche: 'devops',
      modelOverrides: { theme: '' },
    });

    expect(result.success).toBe(false);
  });
});

describe('configProfileUpdateSchema', () => {
  it('accepts a partial update without filling in defaults for omitted fields', () => {
    const result = configProfileUpdateSchema.parse({ name: 'Nova voz' });

    expect(result).toEqual({ name: 'Nova voz' });
  });

  it('rejects empty-string model override values in a partial update', () => {
    const result = configProfileUpdateSchema.safeParse({ modelOverrides: { theme: '' } });

    expect(result.success).toBe(false);
  });
});
