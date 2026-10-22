import { allModels, Video } from "../src/index";
import { runScript } from "./env";

await runScript(async () => {
  for (const model of allModels) {
    const name = model.collection.collectionName;
    const count = await model.countDocuments();
    console.log(`  ${name.padEnd(16)} ${String(count).padStart(5)}`);
  }
  const byStatus = await Video.aggregate<{ _id: string; n: number }>([
    { $match: { deletedAt: null } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  if (byStatus.length) console.log(`  videos by status: ${byStatus.map((s) => `${s._id} ${s.n}`).join(", ")}`);
});
