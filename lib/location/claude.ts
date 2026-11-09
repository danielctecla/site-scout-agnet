import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Options, query } from "@anthropic-ai/claude-agent-sdk";
import { PROPOSAL_SCHEMA, PROPOSAL_SYSTEM } from "./agent";
import { LocationError } from "./types";

// Claude through the local Claude Code login (architecture.md §15, Agent).
// Server only. The agent is isolated: no tools, no settings, CLAUDE.md or MCP
// servers, an empty working directory and no saved session, so text in DENUE
// data or chat messages cannot act on this machine.

const MODEL = "claude-opus-5-5";

let workdir: string | undefined;
const emptyDir = () =>
  (workdir ??= mkdtempSync(join(tmpdir(), "location-agent-")));

async function run(prompt: string, options: Options, timeoutMs: number) {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    for await (const message of query({
      prompt,
      options: {
        model: MODEL,
        tools: [],
        settingSources: [],
        mcpServers: {},
        strictMcpConfig: true,
        persistSession: false,
        maxTurns: 3,
        cwd: emptyDir(),
        // Always the Claude Code login, never an API key from the environment.
        env: { ...process.env, ANTHROPIC_API_KEY: undefined },
        abortController,
        ...options,
      },
    })) {
      if (message.type !== "result") continue;
      if (message.subtype !== "success") throw new Error(message.subtype);
      return message;
    }
    throw new Error("no result");
  } catch (error) {
    console.error("Claude call failed:", (error as Error).message);
    throw new LocationError("analysis_failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function askForProposal(prompt: string): Promise<unknown> {
  const result = await run(
    prompt,
    {
      systemPrompt: PROPOSAL_SYSTEM,
      outputFormat: {
        type: "json_schema",
        schema: PROPOSAL_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    // A 3 km radius in a dense city sends about 300 candidates.
    120_000,
  );
  return result.structured_output;
}

export async function askChat(system: string, prompt: string): Promise<string> {
  const result = await run(prompt, { systemPrompt: system }, 45_000);
  return result.result.trim();
}
