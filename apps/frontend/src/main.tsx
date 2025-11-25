import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/lib/router';
import './index.css';

// Initialize Sentry for error tracking (optional, gated by env var)
const SENTRY_DSN = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;
const ENABLE_SENTRY = import.meta.env['VITE_ENABLE_SENTRY'] !== 'false';
if (SENTRY_DSN && ENABLE_SENTRY) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
    // Session Replay
    replaysSessionSampleRate: 0.1, // Sample 10% of sessions
    replaysOnErrorSampleRate: 1.0, // Always capture sessions with errors
    environment: import.meta.env.MODE,
  });
  console.log('📊 Sentry error tracking initialized');
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
