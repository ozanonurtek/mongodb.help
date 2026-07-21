import { MongoClient } from "mongodb";

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  return new MongoClient(uri).connect();
}

// Defer the env check + connection until first await so that importing this
// module never throws at build time (when MONGODB_URI is not yet available).
const clientPromise: Promise<MongoClient> =
  globalForMongo._mongoClientPromise ??
  new Promise<MongoClient>((resolve, reject) => {
    try {
      createClientPromise().then(resolve, reject);
    } catch (err) {
      reject(err);
    }
  });

if (process.env.NODE_ENV !== "production") {
  globalForMongo._mongoClientPromise = clientPromise;
}

export default clientPromise;
