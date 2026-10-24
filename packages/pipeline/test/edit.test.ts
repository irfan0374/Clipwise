import { describe, expect, it } from "vitest";
import {
  addScene,
  afterEdit,
  changedForFactcheck,
  deleteScene,
  EditError,
  editScene,
  renameScript,
  reorderScenes,
  type StoredClaim,
  switchVisual,
} from "../src/edit";
import { readScene } from "../src/stages/rewrite";
import type { Scene } from "../src/types";
import { validScript } from "./fixtures";

const claim = (scene: number, text = `claim ${scene}`): StoredClaim => ({
  scene,
  text,
  verdict: "wrong",
  fix: "",
  acceptedAt: null,
});

describe("editScene", () => {
  it("changes the narration and keeps the hook in sync", () => {
    const before = validScript();
    const after = editScene(before, 0, { narration: "  A new hook?  " });
    expect(after.scenes[0]!.narration).toBe("A new hook?");
    expect(after.hook).toBe("A new hook?");
    expect(before.scenes[0]!.narration).not.toBe("A new hook?"); // input untouched
  });

  it("keeps the CTA in sync with the last scene's last sentence", () => {
    const after = editScene(validScript(), 4, { narration: "First part. Follow for more!" });
    expect(after.cta).toBe("Follow for more!");
  });

  it("refuses empty or too long text", () => {
    expect(() => editScene(validScript(), 1, { narration: "   " })).toThrow(EditError);
    expect(() => editScene(validScript(), 1, { narration: "x".repeat(401) })).toThrow(EditError);
    expect(() => editScene(validScript(), 1, { onScreenText: ["", " "] })).toThrow(EditError);
    expect(() => editScene(validScript(), 1, { onScreenText: ["a", "b", "c", "d"] })).toThrow(EditError);
    expect(() => editScene(validScript(), 1, { onScreenText: ["x".repeat(61)] })).toThrow(EditError);
  });

  it("drops empty lines", () => {
    expect(editScene(validScript(), 3, { onScreenText: ["One", "", "Two"] }).scenes[3]!.onScreenText).toEqual([
      "One",
      "Two",
    ]);
  });

  it("needs a number to switch to a big-number layout", () => {
    expect(() => editScene(validScript(), 3, { template: "stat" })).toThrow("Add the number");
    const after = editScene(validScript(), 3, { template: "stat", stat: { value: "92%", label: "of people" } });
    expect(after.scenes[3]).toMatchObject({ template: "stat", stat: { value: "92%" } });
    expect(after.scenes[3]!.visual).toBeUndefined();
  });

  it("gives a visual when leaving the big-number layout", () => {
    const after = editScene(validScript(), 2, { template: "bullets" });
    expect(after.scenes[2]!.stat).toBeUndefined();
    expect(after.scenes[2]!.visual?.type).toBe("icon");
  });

  it("checks big numbers", () => {
    expect(() => editScene(validScript(), 2, { stat: { value: "many", label: "x" } })).toThrow(EditError);
    expect(() => editScene(validScript(), 2, { stat: { value: "1234567", label: "x" } })).toThrow(EditError);
    expect(() => editScene(validScript(), 3, { stat: { value: "5", label: "x" } })).toThrow("Only big-number");
    expect(editScene(validScript(), 2, { stat: { value: "10x", label: " faster " } }).scenes[2]!.stat).toEqual({
      value: "10x",
      label: "faster",
    });
  });

  it("refuses photo layouts and visuals on big-number scenes", () => {
    expect(() => editScene(validScript(), 3, { template: "imageFocus" })).toThrow(EditError);
    expect(() => editScene(validScript(), 2, { visual: { type: "icon", icon: "sun" } })).toThrow(EditError);
  });

  it("throws for a scene that doesn't exist", () => {
    expect(() => editScene(validScript(), 9, { narration: "x" })).toThrow(EditError);
  });
});

describe("switchVisual", () => {
  const scene = validScript().scenes[4]!; // flow with 2 labelled items

  it("builds a valid visual from what the scene has", () => {
    expect(switchVisual(scene, "compare").items).toHaveLength(2);
    expect(switchVisual(scene, "cycle").items!.length).toBeGreaterThanOrEqual(3);
    expect(switchVisual(scene, "icon", "red")).toMatchObject({ type: "icon", icon: "sun", color: "red" });
  });

  it("only offers bars when the scene already has numbers", () => {
    expect(() => switchVisual(scene, "bars")).toThrow(EditError);
    const withNumbers: Scene = {
      ...scene,
      visual: {
        type: "flow",
        items: [
          { label: "A", value: 3 },
          { label: "B", value: 7 },
        ],
      },
    };
    expect(switchVisual(withNumbers, "bars").items).toHaveLength(2);
  });
});

describe("reorder, add and delete", () => {
  it("reorders scenes but keeps the hook first", () => {
    const { script, moved } = reorderScenes(validScript(), [0, 2, 1, 3, 4]);
    expect(script.scenes[1]!.template).toBe("stat");
    expect(script.scenes.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
    expect(moved.get(1)).toBe(2);
    expect(() => reorderScenes(validScript(), [1, 0, 2, 3, 4])).toThrow("hook");
    expect(() => reorderScenes(validScript(), [0, 1, 1, 3, 4])).toThrow(EditError);
    expect(() => reorderScenes(validScript(), [0, 1, 2])).toThrow(EditError);
  });

  it("adds a scene after another, up to 10", () => {
    const { script, moved, index } = addScene(validScript(), 0);
    expect(index).toBe(1);
    expect(script.scenes).toHaveLength(6);
    expect(script.scenes[1]!.onScreenText).toEqual(["New scene"]);
    expect(moved.get(0)).toBe(0);
    expect(moved.get(1)).toBe(2);
    let full = script;
    for (let i = 0; i < 4; i++) full = addScene(full, 1).script;
    expect(full.scenes).toHaveLength(10);
    expect(() => addScene(full, 1)).toThrow("at most 10");
    expect(() => addScene(validScript(), 7)).toThrow(EditError);
  });

  it("deletes a scene but never the hook, and keeps at least 3", () => {
    const { script, moved } = deleteScene(validScript(), 2);
    expect(script.scenes).toHaveLength(4);
    expect(moved.has(2)).toBe(false);
    expect(moved.get(3)).toBe(2);
    expect(() => deleteScene(validScript(), 0)).toThrow("hook");
    const three = deleteScene(script, 1).script;
    expect(() => deleteScene(three, 1)).toThrow("at least 3");
  });

  it("deleting the last scene updates the CTA", () => {
    const { script } = deleteScene(validScript(), 4);
    expect(script.cta).toBe(script.scenes[3]!.narration.split(/(?<=[.!?])\s+/).at(-1));
  });
});

describe("fact-check bookkeeping", () => {
  it("finds scenes whose facts changed", () => {
    const before = validScript();
    expect(changedForFactcheck(before, editScene(before, 1, { narration: "New words." }))).toEqual([1]);
    expect(changedForFactcheck(before, editScene(before, 3, { visual: { type: "icon", icon: "sun" } }))).toEqual([]);
    expect(changedForFactcheck(before, reorderScenes(before, [0, 2, 1, 3, 4]).script)).toEqual([1, 2]);
  });

  it("drops claims of edited scenes and marks them for a re-check", () => {
    const result = afterEdit({ claims: [claim(1), claim(3)], pending: [], changed: [1] });
    expect(result.claims.map((c) => c.scene)).toEqual([3]);
    expect(result.pending).toEqual([1]);
  });

  it("moves claims and pending scenes with their scene", () => {
    const { moved } = reorderScenes(validScript(), [0, 3, 1, 2, 4]);
    const result = afterEdit({ claims: [claim(3), claim(4)], pending: [1], changed: [], moved });
    expect(result.claims.map((c) => c.scene)).toEqual([1, 4]);
    expect(result.pending).toEqual([2]);
  });

  it("forgets claims and pending of a deleted scene", () => {
    const { moved } = deleteScene(validScript(), 2);
    const result = afterEdit({ claims: [claim(2), claim(3)], pending: [2, 4], changed: [], moved });
    expect(result.claims.map((c) => c.scene)).toEqual([2]);
    expect(result.pending).toEqual([3]);
  });
});

describe("renameScript", () => {
  it("trims and checks the title", () => {
    expect(renameScript(validScript(), "  Blue sky  ").title).toBe("Blue sky");
    expect(() => renameScript(validScript(), " ")).toThrow(EditError);
    expect(() => renameScript(validScript(), "x".repeat(61))).toThrow(EditError);
  });
});

describe("readScene", () => {
  it("forces the index and fixes the visual", () => {
    const scene = readScene(
      {
        index: 7,
        narration: "Hello there.",
        template: "title",
        onScreenText: ["Hi"],
        visual: { type: "icon", icon: "not-real" },
      },
      2,
    );
    expect(scene.index).toBe(2);
    expect(scene.visual?.type).toBe("icon");
    expect(scene.visual?.icon).not.toBe("not-real");
  });

  it("turns an invalid big number into points", () => {
    const scene = readScene(
      { narration: "Lots.", template: "stat", stat: { value: "many", label: "x" }, onScreenText: ["Lots"] },
      1,
    );
    expect(scene.template).toBe("bullets");
    expect(scene.stat).toBeUndefined();
    expect(scene.visual).toBeDefined();
  });

  it("accepts a reply wrapped in { scene }", () => {
    expect(readScene({ scene: { narration: "Hi.", template: "title", onScreenText: ["Hi"] } }, 0).narration).toBe(
      "Hi.",
    );
  });

  it("rejects a reply without narration", () => {
    expect(() => readScene({ template: "title", onScreenText: ["Hi"] }, 0)).toThrow("invalid");
  });
});
