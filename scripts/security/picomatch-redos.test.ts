import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const rootRequire = createRequire(import.meta.url);
const consumers = ['picomatch', 'vite', 'vitest', 'tinyglobby'];

describe('picomatch ReDoS regression', () => {
  it.each(consumers)('%s resolves the patched picomatch and rejects the ReDoS input quickly', (consumer) => {
    const consumerRequire = createRequire(rootRequire.resolve(consumer));
    const picomatchEntry = consumerRequire.resolve('picomatch');
    const metadata = consumerRequire('picomatch/package.json') as { version: string };
    const runner = [
      `const picomatch = require(${JSON.stringify(picomatchEntry)});`,
      `const input = 'a'.repeat(30) + '!';`,
      `process.exit(picomatch.isMatch(input, '+(*a)') ? 2 : 0);`,
    ].join('\n');
    const result = spawnSync(process.execPath, ['-e', runner], { encoding: 'utf8', timeout: 1500 });

    expect(metadata.version).toBe('4.0.8-pravo.0');
    expect((result.error as NodeJS.ErrnoException | undefined)?.code).not.toBe('ETIMEDOUT');
    expect(result.status, result.stderr).toBe(0);
  });

  it('keeps common safe repeated extglobs working', () => {
    const picomatch = rootRequire('picomatch') as { isMatch: (input: string, pattern: string) => boolean };

    expect(picomatch.isMatch('abc', '+(*)')).toBe(true);
    expect(picomatch.isMatch('aaa', '+(a*)')).toBe(true);
    expect(picomatch.isMatch('a'.repeat(30) + '!', '+(*a)')).toBe(false);
  });

  it('micromatch (ESLint toolchain) resolves the patched picomatch 2 and rejects the ReDoS input quickly', () => {
    const mmRequire = createRequire(rootRequire.resolve('micromatch'));
    const entry = mmRequire.resolve('picomatch');
    expect((mmRequire('picomatch/package.json') as { version: string }).version).toBe('2.3.2-pravo.0');
    const runner = `const pm = require(${JSON.stringify(entry)}); process.exit(pm.isMatch('a'.repeat(30) + '!', '+(*a)') ? 2 : 0);`;
    const result = spawnSync(process.execPath, ['-e', runner], { encoding: 'utf8', timeout: 1500 });
    expect((result.error as NodeJS.ErrnoException | undefined)?.code).not.toBe('ETIMEDOUT');
    expect(result.status, result.stderr).toBe(0);
  });

  // Next.js carries its own compiled (unpatched) picomatch, used only to match image URLs against
  // images.remotePatterns / localPatterns. Keep those patterns free of extglobs so it stays unreachable.
  it('next.config has no extglob image patterns that would reach the unpatched copy bundled in Next.js', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
    if (!/remotePatterns|localPatterns/.test(config)) return;
    expect(config).not.toMatch(/[+*?@!]\(/);
  });
});
