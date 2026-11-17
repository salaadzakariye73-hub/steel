import mongoose, { type ClientSession } from 'mongoose';
import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env.ts';

let memoryServer: MongoMemoryServer | MongoMemoryReplSet | null = null;
let transactionsSupported = false;

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  let uri = env.MONGODB_URI;

  if (!uri) {
    try {
      const replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      memoryServer = replSet;
      uri = replSet.getUri();
      transactionsSupported = true;
      console.log('[DB] Started in-memory MongoDB ReplicaSet for development/preview');
    } catch {
      const standalone = await MongoMemoryServer.create();
      memoryServer = standalone;
      uri = standalone.getUri();
      transactionsSupported = false;
      console.log('[DB] Started in-memory standalone MongoDB for development/preview');
    }
  } else {
    // MongoDB Atlas replica sets support transactions natively
    transactionsSupported = uri.includes('mongodb+srv://') || uri.includes('replicaSet=');
  }

  await mongoose.connect(uri, {
    dbName: uri.includes('mongodb+srv://') ? undefined : 'kaah_steel_props',
  });

  console.log(`[DB] Connected to MongoDB (${mongoose.connection.host})`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export async function runInTransaction<T>(
  fn: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  if (!transactionsSupported) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
