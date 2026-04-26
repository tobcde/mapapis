import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Stub mínimo de las env vars que algunos módulos requieren al importarse.
// Las suites individuales pueden sobreescribir con vi.stubEnv.
if (!import.meta.env.VITE_SUPABASE_URL) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
}
