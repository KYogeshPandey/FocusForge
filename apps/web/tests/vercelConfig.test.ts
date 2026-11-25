import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

interface VercelConfig {
  rewrites?: Array<{ source: string; destination: string }>;
  headers?: Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
}

describe('Vercel Proxy & SPA Fallback Configuration', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const configPaths = [
    { name: 'root vercel.json', filePath: path.join(repoRoot, 'vercel.json') },
    { name: 'apps/web/vercel.json', filePath: path.join(repoRoot, 'apps/web/vercel.json') },
  ];

  it.each(configPaths)(
    '$name prioritizes /api/v1 proxy rewrite before SPA fallback and preserves security headers',
    ({ filePath }) => {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(raw) as VercelConfig;

      expect(config.framework).toBe('vite');
      expect(config.buildCommand).toContain('--workspace=@focusforge/shared');
      expect(config.buildCommand).toContain('--workspace=web');
      expect(config.outputDirectory).toBeTruthy();

      const rewrites = config.rewrites || [];
      const apiIdx = rewrites.findIndex(
        (r) =>
          r.source === '/api/v1/:path*' &&
          r.destination === 'https://focusforge-api-68ro.onrender.com/api/v1/:path*'
      );
      const spaIdx = rewrites.findIndex(
        (r) => r.source === '/(.*)' && r.destination === '/index.html'
      );

      expect(apiIdx).toBeGreaterThanOrEqual(0);
      expect(spaIdx).toBeGreaterThan(apiIdx);

      // Verify security headers are preserved
      const globalHeaders = config.headers?.find((h) => h.source === '/(.*)')?.headers || [];
      const headerKeys = globalHeaders.map((h) => h.key);
      expect(headerKeys).toEqual(
        expect.arrayContaining([
          'X-Content-Type-Options',
          'X-Frame-Options',
          'X-XSS-Protection',
          'Referrer-Policy',
        ])
      );
    }
  );
});
