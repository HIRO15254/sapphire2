import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MixGroupInfo, ResolveGroup } from "@/shared/lib/mix-games";
import {
	addVariant,
	MIX_CELL_ERROR,
	updateGroup,
} from "@/shared/lib/mix-games";
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

describe("MixGamesEditor — per-cell validation display (c31)", () => {
	it("marks an invalid blind cell with aria-invalid and the whole-number message", () => {
		let value = addVariant([], "NL Hold'em", resolveGroup);
		value = updateGroup(value, value[0].uid, { blind1: "1.5" });
		render(
			<MixGamesEditor
				onChange={vi.fn()}
				resolveGroup={resolveGroup}
				value={value}
			/>
		);
		expect(screen.getByText(MIX_CELL_ERROR)).toBeInTheDocument();
		expect(screen.getByLabelText("SB")).toHaveAttribute("aria-invalid", "true");
	});

	it("marks an invalid ante cell with aria-invalid and the whole-number message", () => {
		let value = addVariant([], "NL Hold'em", resolveGroup);
		value = updateGroup(value, value[0].uid, { anteType: "bb", ante: "-3" });
		render(
			<MixGamesEditor
				onChange={vi.fn()}
				resolveGroup={resolveGroup}
				value={value}
			/>
		);
		expect(screen.getByText(MIX_CELL_ERROR)).toBeInTheDocument();
		expect(screen.getByLabelText("Ante")).toHaveAttribute(
			"aria-invalid",
			"true"
		);
	});

	it("renders no error for empty and whole-number cells", () => {
		let value = addVariant([], "NL Hold'em", resolveGroup);
		value = updateGroup(value, value[0].uid, { blind1: "100", blind2: "" });
		render(
			<MixGamesEditor
				onChange={vi.fn()}
				resolveGroup={resolveGroup}
				value={value}
			/>
		);
		expect(screen.queryByText(MIX_CELL_ERROR)).not.toBeInTheDocument();
		expect(screen.getByLabelText("SB")).not.toHaveAttribute("aria-invalid");
	});

	it("shows one message per invalid cell in the ante-less (tournament) layout", () => {
		let value = addVariant([], "NL Hold'em", resolveGroup);
		value = updateGroup(value, value[0].uid, { blind1: "abc", ante: "1.5" });
		render(
			<MixGamesEditor
				onChange={vi.fn()}
				resolveGroup={resolveGroup}
				showAnteType={false}
				value={value}
			/>
		);
		expect(screen.getAllByText(MIX_CELL_ERROR)).toHaveLength(2);
	});
});
