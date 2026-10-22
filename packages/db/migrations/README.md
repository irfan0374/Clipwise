# Migrations

One file per schema change, named `YYYY-MM-DD-what-changed.ts`, exporting:

```ts
import type mongoose from "mongoose";
export const up = async (db: mongoose.mongo.Db) => {
  await db.collection("invites").updateMany({ status: { $exists: false } }, { $set: { status: "invited" } });
};
```

`pnpm db:migrate` runs pending files in name order and records them in `_migrations`.
New optional fields need no migration; renamed or newly required fields always get one.
