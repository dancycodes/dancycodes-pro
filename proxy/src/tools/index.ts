import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DbManager } from "../db.js";
import { registerProjectTools } from "./project.js";
import { registerFeatureTools } from "./features.js";
import { registerTaskTools } from "./tasks.js";
import { registerErrorsConventionsTools } from "./errors-conventions.js";
import { registerReviewsTools } from "./reviews.js";
import { registerQaTools } from "./qa.js";
import { registerBugTools } from "./bugs.js";
import { registerFixTools } from "./fixes.js";
import { registerConfigTools } from "./config.js";
import { registerSprintContractTools } from "./sprint-contracts.js";
import { registerEvaluationTools } from "./evaluations.js";
import { registerModuleQaTools } from "./module-qa.js";

/**
 * Registers ALL local CRUD tools on the MCP server. ~30 tools handled locally
 * (pure SQLite operations; no network). Remote-forwarded tools are registered
 * separately via registerRemoteTools().
 */
export function registerAllLocalTools(server: McpServer, dm: DbManager): void {
  registerProjectTools(server, dm);
  registerFeatureTools(server, dm);
  registerTaskTools(server, dm);
  registerErrorsConventionsTools(server, dm);
  registerReviewsTools(server, dm);
  registerQaTools(server, dm);
  registerBugTools(server, dm);
  registerFixTools(server, dm);
  registerConfigTools(server, dm);
  registerSprintContractTools(server, dm);
  registerEvaluationTools(server, dm);
  registerModuleQaTools(server, dm);
}
