import { allModels } from "../src/index";
import { runScript } from "./env";

// Creates missing indexes and drops ones no longer in the schemas. Safe to run repeatedly.
await runScript(async () => {
  for (const model of allModels) {
    const dropped = await model.syncIndexes();
    const indexes = await model.listIndexes();
    const note = dropped.length ? `  (dropped ${dropped.join(", ")})` : "";
    console.log(`  ${model.collection.collectionName.padEnd(16)} ${indexes.length} indexes${note}`);
  }
  console.log("✓ indexes in sync");
});
