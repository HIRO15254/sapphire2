import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	gameMix,
	gameVariant,
	masterGroups,
	masterVariants,
} from "@/features/games/__tests__/fixtures";
import { GameField } from "../game-field";

const NLH_ROW = /NL Hold'em/u;
const HORSE_ROW = /HORSE/u;

const horse = gameMix({ games: ["lhe", "razz"], id: "horse", label: "HORSE" });
const archivedMix = gameMix({
	archivedAt: "2026-11-02T00:00:00.000Z",
	games: ["nlh", "plo"],
	id: "old",
	label: "Old mix",
});
const archivedGame = gameVariant({
	archivedAt: "2026-11-02T00:00:00.000Z",
	groupId: "big-bet",
	id: "short-deck",
	label: "Short Deck",
});

describe("GameField", () => {
	it("picks an active mix by id and closes the picker", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<GameField
				groups={masterGroups}
				mixes={[horse, archivedMix]}
				onChange={onChange}
				value={{ variantId: "nlh" }}
				variants={[...masterVariants, archivedGame]}
			/>
		);

		const trigger = screen.getByRole("button", {
			name: "Game: NL Hold'em. Change",
		});
		await user.click(trigger);
		expect(screen.getByRole("button", { name: NLH_ROW })).toHaveAttribute(
			"aria-pressed",
			"true"
		);
		expect(screen.queryByText("Short Deck")).not.toBeInTheDocument();

		await user.click(screen.getByRole("tab", { name: "Mixes" }));
		expect(screen.queryByText("Old mix")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: HORSE_ROW }));

		expect(onChange).toHaveBeenCalledWith({ gameMixId: "horse" });
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});
});
