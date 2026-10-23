import type mongoose from "mongoose";

// Sign-up became open (email + password, no invites or waitlist), so the invites collection goes away.
export const up = async (db: mongoose.mongo.Db) => {
  const exists = await db.listCollections({ name: "invites" }).hasNext();
  if (exists) await db.dropCollection("invites");
};
