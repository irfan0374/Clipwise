import { describe, expect, it } from "vitest";
import { privateDataCollection, scrubReport } from "../src/monitoring";

describe("error reports", () => {
  it("collect nothing personal", () => {
    expect(privateDataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    });
  });

  it("drop user, request, machine name and secret-looking extras before sending", () => {
    const event = scrubReport({
      message: "boom",
      user: { email: "a@b.c" },
      request: { headers: { cookie: "x" } },
      server_name: "Someones-MacBook",
      extra: { apiKey: "k", MONGODB_URI: "u", userEmail: "e", stage: "render" },
    });
    expect(event).toEqual({ message: "boom", extra: { stage: "render" } });
  });
});
