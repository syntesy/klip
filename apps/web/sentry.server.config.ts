import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN_WEB,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
