// Error reports (Sentry) keep only what's needed to find a bug: the error, its stack and our tags. Sentry v11
// collects much more by default (user, cookies, headers, request bodies, AI prompts and replies, database
// queries, queue payloads, local variables); all of it stays off, since it can hold scripts, topics or keys.
export const privateDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 5,
};

const SECRET = /(key|token|secret|password|authorization|cookie|uri|dsn|email)/i;

type ScrubbableEvent = {
  user?: unknown;
  request?: unknown;
  server_name?: string;
  extra?: Record<string, unknown>;
};

/** Last line of defence before an error report leaves: drops user, request and machine details. */
export function scrubReport<E extends ScrubbableEvent>(event: E): E {
  delete event.user;
  delete event.request;
  delete event.server_name; // the machine's name, e.g. the owner's Mac
  if (event.extra) for (const k of Object.keys(event.extra)) if (SECRET.test(k)) delete event.extra[k];
  return event;
}
