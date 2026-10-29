// Staging and live share one Redis database and one Atlas cluster, so a wrong setting quietly mixes them up: work
// queued under the wrong REDIS_NAMESPACE waits for a worker that never comes, or reaches the other environment's
// worker, which can't find the video in its database. The worker refuses to start and the web app reports it.

/** The database each environment must use. */
export const environmentDatabases: Record<string, string> = { staging: "clipwise_staging", live: "clipwise" };

/** The database name in a MongoDB address (`mongodb+srv://user:pass@host/<name>?options`), if it has one. */
export const databaseInUri = (uri: string) =>
  /\/([^/?]+)(\?|$)/.exec(uri.replace(/^mongodb(\+srv)?:\/\/[^/]+/, ""))?.[1] ?? null;

/** What's wrong with this environment's settings (empty = fine). Nothing is checked locally (no environment). */
export function environmentProblems(
  env: string | undefined,
  settings: { redisNamespace?: string; mongoUri?: string },
): string[] {
  if (!env) return [];
  const expected = environmentDatabases[env];
  if (!expected) return [`the environment must be "staging" or "live", not "${env}"`];
  const problems: string[] = [];
  if (settings.redisNamespace !== `${env}:`) problems.push(`REDIS_NAMESPACE must be "${env}:"`);
  if (databaseInUri(settings.mongoUri ?? "") !== expected)
    problems.push(`MONGODB_URI must use the "${expected}" database`);
  return problems;
}
