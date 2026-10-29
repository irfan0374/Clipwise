import { describe, expect, it } from "vitest";
import { databaseInUri, environmentProblems } from "../src/environment";

const atlas = (db: string) => `mongodb+srv://user:p%40ss@cluster0.abc.mongodb.net/${db}?retryWrites=true&w=majority`;

describe("environment settings", () => {
  it("reads the database name from a MongoDB address", () => {
    expect(databaseInUri(atlas("clipwise_staging"))).toBe("clipwise_staging");
    expect(databaseInUri("mongodb://127.0.0.1:27017/clipwise_dev")).toBe("clipwise_dev");
    expect(databaseInUri("mongodb+srv://user:pass@cluster0.abc.mongodb.net/?retryWrites=true")).toBeNull();
  });

  it("checks nothing locally", () => {
    expect(environmentProblems(undefined, {})).toEqual([]);
    expect(environmentProblems("", { redisNamespace: "live:" })).toEqual([]);
  });

  it("accepts each environment's own namespace and database", () => {
    expect(environmentProblems("staging", { redisNamespace: "staging:", mongoUri: atlas("clipwise_staging") })).toEqual(
      [],
    );
    expect(environmentProblems("live", { redisNamespace: "live:", mongoUri: atlas("clipwise") })).toEqual([]);
  });

  it("catches a missing or mixed-up namespace or database", () => {
    expect(environmentProblems("live", { mongoUri: atlas("clipwise") })).toEqual(['REDIS_NAMESPACE must be "live:"']);
    expect(environmentProblems("live", { redisNamespace: "staging:", mongoUri: atlas("clipwise_staging") })).toEqual([
      'REDIS_NAMESPACE must be "live:"',
      'MONGODB_URI must use the "clipwise" database',
    ]);
    expect(environmentProblems("prod", {})).toEqual(['the environment must be "staging" or "live", not "prod"']);
  });

  it("never repeats the MongoDB address (it holds the password)", () => {
    const problems = environmentProblems("live", { redisNamespace: "live:", mongoUri: atlas("other") });
    expect(problems.join(" ")).not.toContain("p%40ss");
  });
});
