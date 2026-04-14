import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const logtailToken = process.env.LOGTAIL_SOURCE_TOKEN;

function createLogger(): pino.Logger {
  if (isProduction && logtailToken) {
    try {
      // Dynamic require to keep dev startup fast and avoid bundling issues
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Logtail } = require("@logtail/node") as typeof import("@logtail/node");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const logtailTransport = require("@logtail/pino").default as (l: InstanceType<typeof Logtail>) => NodeJS.WritableStream;
      const logtail = new Logtail(logtailToken);
      return pino(
        { level: "info" },
        pino.multistream([
          { stream: process.stdout },
          { stream: logtailTransport(logtail) },
        ])
      );
    } catch {
      // If Logtail fails, fall back to stdout
    }
  }

  return pino({
    level: "debug",
    transport: { target: "pino-pretty" },
  });
}

export const logger = createLogger();
