// lib/mongodb.ts
// Single shared MongoClient. In dev, Next.js hot-reloads modules, so we cache
// the client on globalThis to avoid opening a new connection on every reload.
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Missing MONGODB_URI in .env.local");
}

const options = {};

let client: MongoClient;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(uri, options);
  }
  client = global._mongoClient;
} else {
  client = new MongoClient(uri, options);
}

// The database used across the app (name comes from the URI path, e.g. /hush).
export const db: Db = client.db();
export { client };
