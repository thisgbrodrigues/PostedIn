import { describe, it, expect } from 'vitest';
import { brandbookInputSchema } from './schema';

describe('brandbookInputSchema', () => {
  it('accepts a minimal valid brandbook and fills in defaults', () => {
    const result = brandbookInputSchema.parse({
      name: 'Ana Silva',
      role: 'Head de Engenharia',
      company: 'Acme',
      industry: 'devops',
    });

    expect(result.bio).toBe('');
    expect(result.values).toBe('');
    expect(result.voiceReferences).toBe('');
  });

  it('rejects a brandbook missing required fields', () => {
    const result = brandbookInputSchema.safeParse({ name: 'Ana Silva' });

    expect(result.success).toBe(false);
  });
});
