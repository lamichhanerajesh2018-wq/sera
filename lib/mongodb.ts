// lib/mongodb.ts
// Single shared MongoClient. We tolerate a missing MONGODB_URI at module-load
// time (Next.js imports this during the build, before env vars are guaranteed)
// by falling back to a harmless placeholder URI. The real connection only opens
// when a query runs at request time — by which point the env var must be set.
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri && process.env.NODE_ENV !== "production") {
  // Local dev without a URI is almost always a mistake — surface it loudly.
  // (In production/build we stay quiet so the build can complete; a real query
  // will fail clearly at runtime if the Vercel env var is missing.)
  console.warn("[mongodb] MONGODB_URI is not set — database calls will fail.");
}

// A syntactically valid placeholder so `new MongoClient()` doesn't throw during
// the build when the env var is absent. It never actually connects.
const effectiveUri = uri || "mongodb://127.0.0.1:27017/placeholder";

const options = {};

let client: MongoClient;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(effectiveUri, options);
  }
  client = global._mongoClient;
} else {
  client = new MongoClient(effectiveUri, options);
}

// The database used across the app (name comes from the URI path, e.g. /hush).
export const db: Db = client.db();
export { client };
