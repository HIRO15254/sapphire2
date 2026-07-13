import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MixGroupInfo, ResolveGroup } from "@/shared/lib/mix-games";
import { addVariant, updateGroup } from "@/shared/lib/mix-games";
import { MixGamesEditor } from "../mix-games-editor";

const BIGBET: MixGroupInfo = {
	id: "g-bigbet",
	label: "Big Bet",
	blind1Label: "SB",
	blind2Label: "BB",
	blind3Label: "Straddle",
	sortIndex: 2,
};

const resolveGroup: ResolveGroup = () => BIGBET;

describe("MixGamesEditor — group heading", () => {
	it("falls back to the group label when the per-mix name is null", () => {
		const value = addVariant([], "NL Hold'em", resolveGroup);
		render(
			<MixGamesEditor
				onChange={vi.fn()}
				resolveGroup={resolveGroup}
				value={value}
			/>
		);
		expect(screen.getByText("Big Bet")).toBeInTheDocument();
	});

	it("shows the stored per-mix name when present", () => {
		let value = addVariant([], "NL Hold'em", resolveGroup);
		value = updateGroup(value, value[0].uid, { name: "Round 1" });
		render(
			<MixGamesEditor
				onChange={vi.fn()}
				resolveGroup={resolveGroup}
				value={value}
			/>
		);
		expect(screen.getByText("Round 1")).toBeInTheDocument();
		expect(screen.queryByText("Big Bet")).not.toBeInTheDocument();
	});
});
