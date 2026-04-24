import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import {
  ManageReviewsModeSchema,
  SpecReviewCategorySchema,
  SpecReviewStatusSchema,
} from "../schemas.js";
import { ok, err } from "../helpers.js";

export function registerReviewsTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "manage_reviews",
    {
      title: "Add or query spec reviews",
      description:
        "Mode 'add' records a review finding; mode 'query' retrieves findings filtered by round/status.",
      inputSchema: {
        mode: ManageReviewsModeSchema,
        review_round: z.number().int().min(1).optional(),
        category: SpecReviewCategorySchema.optional(),
        finding: z.string().optional(),
        resolution: z.string().optional(),
        status: SpecReviewStatusSchema.optional(),
      },
    },
    async ({ mode, review_round, category, finding, resolution, status }) => {
      const db = dm.getDb();
      if (mode === "add") {
        if (!review_round || !category || !finding) {
          return err("review_round, category, and finding are required for mode='add'.");
        }
        db.prepare(
          `INSERT INTO spec_review (review_round, category, finding, resolution, status)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(review_round, category, finding, resolution ?? null, status ?? "open");
        return ok({ status: "recorded", category, review_round });
      }

      let sql = "SELECT * FROM spec_review WHERE 1=1";
      const params: unknown[] = [];
      if (review_round !== undefined) {
        sql += " AND review_round = ?";
        params.push(review_round);
      }
      if (status !== undefined) {
        sql += " AND status = ?";
        params.push(status);
      }
      sql += " ORDER BY id";
      const reviews = db.prepare(sql).all(...params);
      return ok({ count: Array.isArray(reviews) ? reviews.length : 0, reviews });
    },
  );
}
