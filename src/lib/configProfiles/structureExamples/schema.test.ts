import { describe, it, expect } from 'vitest';
import { structureExampleInputSchema } from './schema';

describe('structureExampleInputSchema', () => {
  it('accepts a .md filename with content', () => {
    const result = structureExampleInputSchema.safeParse({ filename: 'exemplo.md', content: '# Título' });

    expect(result.success).toBe(true);
  });

  it('accepts a .txt filename with content', () => {
    const result = structureExampleInputSchema.safeParse({ filename: 'exemplo.txt', content: 'texto' });

    expect(result.success).toBe(true);
  });

  it('rejects a filename that is not .md or .txt', () => {
    const result = structureExampleInputSchema.safeParse({ filename: 'exemplo.png', content: 'texto' });

    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = structureExampleInputSchema.safeParse({ filename: 'exemplo.md', content: '' });

    expect(result.success).toBe(false);
  });
});
