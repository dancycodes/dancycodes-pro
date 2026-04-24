import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RemoteClient } from "./client.js";
import { ok } from "../helpers.js";

/**
 * Forward the 4 DancyCodes methodology tools (dc_load_phase, dc_get_reference,
 * dc_list_references, dc_transition_phase) from the engine through the proxy.
 * This means Claude only ever talks to ONE MCP server — simpler UX, fewer
 * duplicate tool names.
 */
export function registerMethodologyTools(server: McpServer, client: RemoteClient): void {
  server.registerTool(
    "dc_load_phase",
    {
      title: "Load DancyCodes methodology for a phase",
      description:
        "Returns the complete methodology for a given DancyCodes workflow phase. Call at phase boundaries. Start with phase='interview_intro' for new projects. Use prompt caching — subsequent calls are cheap.",
      inputSchema: {
        phase: z
          .string()
          .min(1)
          .describe('Phase name. Start with "interview_intro" for a new project.'),
        session_context: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Client-side session state (complexity, tech_stack, interview answers, etc.)"),
      },
    },
    async ({ phase, session_context }) => {
      const result = await client.callTool("dc_load_phase", { phase, session_context });
      return ok(result);
    },
  );

  server.registerTool(
    "dc_transition_phase",
    {
      title: "Transition to the next methodology phase",
      description:
        "Signals that the current phase is complete and loads the methodology for the next phase.",
      inputSchema: {
        from: z.string().min(1),
        to: z.string().min(1),
        session_context: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ from, to, session_context }) => {
      const result = await client.callTool("dc_transition_phase", { from, to, session_context });
      return ok(result);
    },
  );

  server.registerTool(
    "dc_get_reference",
    {
      title: "Fetch a specific DancyCodes reference guide",
      description:
        "Returns the full content of a named reference guide (e.g., 'feature-file-guide', 'tech-stack', 'orchestrator-guide'). Call on demand during a phase.",
      inputSchema: {
        name: z.string().min(1).describe("Reference name without file extension."),
      },
    },
    async ({ name }) => {
      const result = await client.callTool("dc_get_reference", { name });
      return ok(result);
    },
  );

  server.registerTool(
    "dc_list_references",
    {
      title: "List all available DancyCodes references",
      description:
        "Returns the list of reference guides and phases available from the DancyCodes engine.",
      inputSchema: {},
    },
    async () => {
      const result = await client.callTool("dc_list_references", {});
      return ok(result);
    },
  );
}
