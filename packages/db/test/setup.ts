import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll } from "vitest";
import { allModels, connectDb, disconnectDb } from "../src/index";

// Each test file gets its own throwaway in-memory MongoDB; no Atlas or internet needed after the first download.
let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  await connectDb({ uri: server.getUri("clipwise_test"), autoIndex: false });
  await Promise.all(allModels.map((m) => m.syncIndexes()));
}, 120_000);

afterEach(async () => {
  await Promise.all(allModels.map((m) => m.deleteMany({})));
});

afterAll(async () => {
  await disconnectDb();
  await server?.stop();
});
