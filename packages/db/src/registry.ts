import type { Model } from "mongoose";
import { AuditEvent } from "./models/auditEvent";
import { PipelineRun } from "./models/pipelineRun";
import { Render } from "./models/render";
import { ScriptVersion } from "./models/scriptVersion";
import { UsageEvent } from "./models/usageEvent";
import { Video } from "./models/video";
import { Workspace } from "./models/workspace";

/** Every Clipwise model, for index builds, status and tests (schema-agnostic methods only). */
// biome-ignore lint/suspicious/noExplicitAny: the models have different schemas
export const allModels: Model<any>[] = [Workspace, Video, ScriptVersion, Render, PipelineRun, UsageEvent, AuditEvent];
