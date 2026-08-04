import {
	expectProtected,
	getInputSchema,
	getProcedureDef,
} from "@sapphire2/api/__tests__/test-utils";
import { describe, expect, it } from "vitest";
import {
	DELIBERATELY_EXCLUDED,
	TOOL_DEFINITIONS,
	toolAnnotations,
	toolPermissionSummary,
} from "../registry";
import { getProcedure, listProcedurePaths } from "../resolve";

/**
 * The MCP surface is a projection of appRouter — these tests are the
 * mechanism that makes drift between the two structurally impossible:
 *
 * - every tool's input schema must BE (same object) the schema the router
 *   validates with, so the MCP contract can never diverge from the API;
 * - every router procedure must be either exposed or deliberately excluded,
 *   so adding a backend procedure forces an explicit MCP decision
 *   (see .claude/rules/mcp-tools.md).
 */

const SNAKE_CASE_TOOL_NAME = /^[a-z][a-z0-9_]*$/;

const allPaths = listProcedurePaths();
const exposedPaths = new Set(TOOL_DEFINITIONS.map((d) => d.procedurePath));
const excludedPaths = new Set(
	DELIBERATELY_EXCLUDED.flatMap((group) => group.paths)
);

describe("tool/router coupling", () => {
	it("exposes every tool input schema as the exact Zod object the router validates with", () => {
		for (const def of TOOL_DEFINITIONS) {
			const procedure = getProcedure(def.procedurePath);
			if (def.procedurePath === "session.create") {
				// session.create is a discriminated union; each branch is its own
				// tool. The branch schema must be one of the union's own members.
				const union = getInputSchema(procedure) as unknown as {
					options: unknown[];
				};
				expect(union.options).toContain(def.inputSchema);
			} else if (def.inputSchema === undefined) {
				expect(getProcedureDef(procedure).inputs).toHaveLength(0);
			} else {
				expect(def.inputSchema).toBe(getInputSchema(procedure));
			}
		}
	});

	it("covers every branch of the session.create union with a dedicated tool", () => {
		const union = getInputSchema(getProcedure("session.create")) as unknown as {
			options: unknown[];
		};
		const branchSchemas = TOOL_DEFINITIONS.filter(
			(d) => d.procedurePath === "session.create"
		).map((d) => d.inputSchema);
		expect(union.options).toHaveLength(branchSchemas.length);
		for (const option of union.options) {
			expect(branchSchemas).toContain(option);
		}
	});

	it("accounts for every appRouter procedure as exposed or deliberately excluded", () => {
		const unaccounted = allPaths.filter(
			(path) => !(exposedPaths.has(path) || excludedPaths.has(path))
		);
		expect(unaccounted).toEqual([]);
	});

	it("never lists a procedure as both exposed and excluded", () => {
		const overlap = [...exposedPaths].filter((path) => excludedPaths.has(path));
		expect(overlap).toEqual([]);
	});

	it("has no stale exclusion entries for procedures that no longer exist", () => {
		const stale = [...excludedPaths].filter((path) => !allPaths.includes(path));
		expect(stale).toEqual([]);
	});

	it("gives every exclusion group a non-empty reason and at least one path", () => {
		for (const group of DELIBERATELY_EXCLUDED) {
			expect(group.reason.length).toBeGreaterThan(0);
			expect(group.paths.length).toBeGreaterThan(0);
		}
	});

	it("only exposes protected procedures", () => {
		for (const path of exposedPaths) {
			expectProtected(getProcedure(path));
		}
	});

	it("derives readOnlyHint from the router's query/mutation type", () => {
		for (const def of TOOL_DEFINITIONS) {
			const { type } = getProcedureDef(getProcedure(def.procedurePath));
			expect(toolAnnotations(def).readOnlyHint).toBe(type === "query");
		}
	});

	it("marks read-only tools as non-destructive and idempotent", () => {
		for (const def of TOOL_DEFINITIONS) {
			const { type } = getProcedureDef(getProcedure(def.procedurePath));
			if (type === "query") {
				expect(toolAnnotations(def)).toEqual({
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: false,
				});
			}
		}
	});

	it("declares explicit destructive/idempotent hints on every mutation tool", () => {
		for (const def of TOOL_DEFINITIONS) {
			const { type } = getProcedureDef(getProcedure(def.procedurePath));
			if (type === "mutation") {
				const annotations = toolAnnotations(def);
				expect(annotations.readOnlyHint).toBe(false);
				expect(annotations.openWorldHint).toBe(false);
				expect(typeof annotations.destructiveHint).toBe("boolean");
				expect(typeof annotations.idempotentHint).toBe("boolean");
			}
		}
	});

	it("uses valid, unique snake_case tool names", () => {
		const names = TOOL_DEFINITIONS.map((d) => d.name);
		for (const name of names) {
			expect(name).toMatch(SNAKE_CASE_TOOL_NAME);
		}
		expect(new Set(names).size).toBe(names.length);
	});

	it("gives every tool a non-empty description", () => {
		for (const def of TOOL_DEFINITIONS) {
			expect(def.description.trim().length).toBeGreaterThan(0);
		}
	});

	it("exposes the agreed tool catalogue and nothing else", () => {
		expect(TOOL_DEFINITIONS.map((d) => d.name).sort()).toEqual([
			"currency_list",
			"game_group_create",
			"game_group_list",
			"game_group_update",
			"game_mix_create",
			"game_mix_list",
			"game_mix_update",
			"game_variant_create",
			"game_variant_list",
			"game_variant_update",
			"player_list",
			"ring_game_archive",
			"ring_game_create",
			"ring_game_list_by_room",
			"ring_game_restore",
			"ring_game_update",
			"room_create",
			"room_get_by_id",
			"room_list",
			"room_update",
			"session_create_cash_game",
			"session_create_tournament",
			"session_get_by_id",
			"session_list",
			"session_tag_create",
			"session_tag_list",
			"session_update",
			"stats_breakdown",
			"stats_profit_loss_series",
			"stats_summary",
			"tournament_archive",
			"tournament_create_with_levels",
			"tournament_get_by_id",
			"tournament_list_by_room",
			"tournament_restore",
			"tournament_update_with_levels",
		]);
	});

	it("enumerates the full router procedure list (guard for the exclusion sweep)", () => {
		// A floor, not an exact count: additions are caught by the coverage
		// test above (which names the unregistered path), while this catches a
		// resolver returning an empty/partial list and making that test vacuous.
		expect(allPaths.length).toBeGreaterThanOrEqual(124);
	});

	it("derives the consent-screen permissions from the catalogue's annotations", () => {
		const annotations = TOOL_DEFINITIONS.map(toolAnnotations);
		const summary = toolPermissionSummary().join(" ");
		// Reading is unconditional; the other two lines must track the
		// catalogue so a newly added write/destructive tool cannot leave the
		// consent screen under-representing the grant (mcp-tools.md rule 8).
		expect(summary).toContain("Read your poker sessions");
		expect(summary.includes("Record new sessions")).toBe(
			annotations.some((annotation) => !annotation.readOnlyHint)
		);
		expect(summary.includes("cannot be undone")).toBe(
			annotations.some((annotation) => annotation.destructiveHint)
		);
	});
});
