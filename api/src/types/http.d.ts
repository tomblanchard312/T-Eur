/**
 * Ambient augmentation for the raw request body captured by the
 * express.json/urlencoded `verify` hooks.
 *
 * The `verify` callback is typed against `http.IncomingMessage`, not the
 * Express `Request`, so the augmentation has to live on the Node type.
 * Express's `Request` extends `IncomingMessage`, so this single declaration
 * covers both the capture site (src/index.ts) and the consumer
 * (src/middleware/requestSignature.ts).
 */
import 'node:http';

declare module 'node:http' {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

declare module 'http' {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}
