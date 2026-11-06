import { expect, vi } from "vitest";
import { callTool, type RouterCaller } from "../../../mcp/src/tools/call";
import { TOOL_DEFINITIONS } from "../../../mcp/src/tools/registry";
import { test as integrationTest, requireCreatedRow } from "./test-fixture";

function defByName(name: string) {
	const def = TOOL_DEFINITIONS.find((item) => item.name === name);
	if (!def) {
		throw new Error(`unknown tool in test: ${name}`);
	}
	return def;
}
integrationTest(
	"round-trips ring-game IDs, lineups and stakes through MCP tools",
	async ({ api }) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const group = requireCreatedRow(
			await api.alice.gameGroup.create({
				blind1Label: "Small",
				blind2Label: "Big",
				label: "MCP group",
			})
		);
		const first = requireCreatedRow(
			await api.alice.gameVariant.create({
				groupId: group.id,
				label: "MCP first",
			})
		);
		const second = requireCreatedRow(
			await api.alice.gameVariant.create({
				groupId: group.id,
				label: "MCP second",
			})
		);
		const mix = requireCreatedRow(
			await api.alice.gameMix.create({
				games: [first.id, second.id],
				label: "MCP mix",
			})
		);
		const caller = api.alice as unknown as RouterCaller;
		async function invoke(name: string, input: unknown) {
			const result = await callTool(defByName(name), caller, input, vi.fn());
			expect(result.isError).toBeUndefined();
			return JSON.parse(result.content[0]?.text ?? "null");
		}
		const variants: { id: string }[] = await invoke("game_variant_list", {});
		const mixes: { id: string }[] = await invoke("game_mix_list", {});
		expect(variants.map((variant) => variant.id)).toContain(first.id);
		expect(mixes.map((item) => item.id)).toContain(mix.id);

		const created = await invoke("ring_game_create", {
			name: "Cash",
			roomId: room.id,
			rule: {
				game: { gameMixId: mix.id },
				stakes: [{ blind1: 1, blind2: 2, gameGroupId: group.id }],
			},
		});
		const { lineupId } = created.ruleVersion;
		expect(created.lineups[lineupId].gameMixId).toBe(mix.id);
		expect(created.ruleVersion.stakes[0]).toMatchObject({
			blind1: 1,
			blind2: 2,
		});

		const updated = await invoke("ring_game_update", {
			id: created.id,
			rule: {
				game: { lineupId },
				stakes: [{ blind1: 2, blind2: 4, gameGroupId: group.id }],
			},
		});
		expect(updated.ruleVersion.lineupId).toBe(lineupId);
		expect(updated.currentRuleId).not.toBe(created.currentRuleId);
		expect(updated.ruleVersion.stakes[0]).toMatchObject({
			blind1: 2,
			blind2: 4,
		});
		const listed = await invoke("ring_game_list_by_room", { roomId: room.id });
		expect(listed).toContainEqual(expect.objectContaining(updated));
	},
	60_000
);
