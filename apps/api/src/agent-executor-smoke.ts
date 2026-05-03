import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentServerEvent, GenerationPlan } from "./contracts.js";
import type { EditImageProviderInput, ImageProvider, ImageProviderInput, ProviderResult } from "./image-provider.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = resolve(repoRoot, ".codex-temp", `agent-executor-smoke-${process.pid}-${Date.now()}`);
process.env.DATA_DIR = dataDir;
process.env.SQLITE_JOURNAL_MODE = "DELETE";
process.env.SQLITE_LOCKING_MODE = "EXCLUSIVE";

mkdirSync(dataDir, { recursive: true });

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

async function main(): Promise<void> {
  try {
    const [{ executeGenerationPlan }, { closeDatabase }] = await Promise.all([
      import("./agent-executor.js"),
      import("./database.js")
    ]);

    try {
      const successProvider = new FakeImageProvider();
      const events: AgentServerEvent[] = [];
      const success = await executeGenerationPlan({
        plan: planFixture(),
        selectedReferences: [],
        mode: "execute",
        provider: successProvider,
        requestId: "smoke-execute",
        runId: "run-smoke",
        signal: new AbortController().signal,
        isRunActive: () => true,
        sendEvent: (event) => events.push(event)
      });

      expect(success.status === "succeeded", "DAG execution succeeds");
      expect(success.plan.jobs.every((job) => job.status === "succeeded"), "all jobs are marked succeeded");
      expect(successProvider.generateCalls === 1, "anchor job uses text-to-image generation");
      expect(successProvider.editCalls === 1, "downstream generated reference uses edit generation");
      expect(events.filter((event) => event.type === "asset_preview").length === 2, "each generated asset emits a preview");

      const retryProvider = new FakeImageProvider();
      const retryPlan = clonePlan(success.plan);
      const finalJob = retryPlan.jobs.find((job) => job.id === "final_scene");
      expect(finalJob, "retry fixture includes final job");
      finalJob.status = "failed";
      finalJob.outputs = [];
      finalJob.error = "retry me";
      retryPlan.status = "partial";

      const retry = await executeGenerationPlan({
        plan: retryPlan,
        selectedReferences: [],
        mode: "retry_failed",
        provider: retryProvider,
        requestId: "smoke-retry",
        runId: "run-retry",
        signal: new AbortController().signal,
        isRunActive: () => true,
        sendEvent: () => undefined
      });
      expect(retry.status === "succeeded", "retry_failed recovers failed downstream job");
      expect(retryProvider.generateCalls === 0, "retry keeps succeeded upstream anchor");
      expect(retryProvider.editCalls === 1, "retry reruns failed downstream job");

      const failedProvider = new FakeImageProvider({ failGenerate: true });
      const blocked = await executeGenerationPlan({
        plan: planFixture("plan-blocked"),
        selectedReferences: [],
        mode: "execute",
        provider: failedProvider,
        requestId: "smoke-blocked",
        runId: "run-blocked",
        signal: new AbortController().signal,
        isRunActive: () => true,
        sendEvent: () => undefined
      });
      expect(blocked.status === "failed", "failed upstream plan reports failed");
      expect(blocked.plan.jobs.find((job) => job.id === "final_scene")?.status === "blocked", "downstream job is blocked");
    } finally {
      closeDatabase();
    }

    console.log("agent executor smoke checks passed");
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

class FakeImageProvider implements ImageProvider {
  generateCalls = 0;
  editCalls = 0;

  constructor(private readonly options: { failGenerate?: boolean } = {}) {}

  async generate(input: ImageProviderInput): Promise<ProviderResult> {
    this.generateCalls += 1;
    if (this.options.failGenerate) {
      throw new Error("fake text generation failed");
    }

    return providerResult(input.sizeApiValue);
  }

  async edit(input: EditImageProviderInput): Promise<ProviderResult> {
    this.editCalls += 1;
    expect(input.referenceImages.length > 0, "edit generation receives references");
    return providerResult(input.sizeApiValue);
  }
}

function providerResult(size: string): ProviderResult {
  return {
    model: "fake-image-model",
    size,
    images: [
      {
        b64Json: tinyPngBase64
      }
    ]
  };
}

function planFixture(id = "plan-smoke"): GenerationPlan {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    schemaVersion: 1,
    id,
    title: "Agent executor smoke plan",
    status: "awaiting_confirmation",
    defaults: {
      size: {
        width: 1024,
        height: 1024
      },
      quality: "auto",
      outputFormat: "png",
      count: 1
    },
    jobs: [
      {
        id: "character_anchor",
        role: "character_anchor",
        prompt: "Create one reusable character anchor.",
        count: 1,
        references: [],
        status: "queued",
        outputs: [],
        visible: true
      },
      {
        id: "final_scene",
        role: "final_image",
        prompt: "Create one final scene with the generated character.",
        count: 1,
        references: [
          {
            kind: "generated_output",
            usage: "character",
            jobId: "character_anchor"
          }
        ],
        status: "queued",
        outputs: [],
        visible: true
      }
    ],
    edges: [
      {
        fromJobId: "character_anchor",
        toJobId: "final_scene"
      }
    ],
    createdBy: "agent",
    createdAt: now,
    updatedAt: now
  };
}

function clonePlan(plan: GenerationPlan): GenerationPlan {
  return {
    ...plan,
    defaults: {
      ...plan.defaults,
      size: { ...plan.defaults.size }
    },
    jobs: plan.jobs.map((job) => ({
      ...job,
      size: job.size ? { ...job.size } : undefined,
      references: job.references.map((reference) => ({ ...reference })),
      outputs: job.outputs.map((output) => ({
        ...output,
        asset: output.asset ? { ...output.asset, cloud: output.asset.cloud ? { ...output.asset.cloud } : undefined } : undefined
      }))
    })),
    edges: plan.edges.map((edge) => ({ ...edge }))
  };
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

await main();
