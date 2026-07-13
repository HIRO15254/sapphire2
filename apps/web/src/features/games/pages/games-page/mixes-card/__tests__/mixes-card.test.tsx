import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GameMixRow, GameVariantRow } from "../../use-games-page";
import { MixesCard, type MixesCardProps } from "../mixes-card";

function mixRow(overrides: Partial<GameMixRow> = {}): GameMixRow {
	return {
		id: "m-1",
		builtinKey: "horse",
		label: "HORSE",
		games: ["v-1", "v-2"],
		...overrides,
	};
}

function variantRow(overrides: Partial<GameVariantRow> = {}): GameVariantRow {
	return {
		id: "v-1",
		builtinKey: null,
		label: "Limit Hold'em",
		shortLabel: "LHE",
		groupId: "g-1",
		sortOrder: 0,
		...overrides,
	};
}

const VARIANTS: GameVariantRow[] = [
	variantRow({ id: "v-1", label: "Limit Hold'em" }),
	variantRow({ id: "v-2", label: "Razz" }),
];

function renderCard(overrides: Partial<MixesCardProps> = {}) {
	const props: MixesCardProps = {
		mixes: overrides.mixes ?? [mixRow()],
		onDeleteMix: vi.fn(),
		onEditMix: vi.fn(),
		variants: overrides.variants ?? VARIANTS,
		...overrides,
	};
	render(<MixesCard {...props} />);
	return props;
}

describe("MixesCard", () => {
	it("renders the 'Mixes' header band title", () => {
		renderCard();
		expect(screen.getByText("Mixes")).toBeInTheDocument();
	});

	it("renders each mix's label, game count, and composition", () => {
		renderCard();
		expect(screen.getByText("HORSE")).toBeInTheDocument();
		expect(
			screen.getByText("2 games: Limit Hold'em, Razz")
		).toBeInTheDocument();
	});

	it("never renders a Default badge, even for a builtin mix", () => {
		renderCard();
		expect(screen.queryByText("Default")).not.toBeInTheDocument();
	});

	it("renders the resolved variant labels visibly instead of only in a title tooltip", () => {
		renderCard();
		expect(
			screen.getByText("2 games: Limit Hold'em, Razz")
		).toBeInTheDocument();
		expect(
			screen.getByText("2 games: Limit Hold'em, Razz")
		).not.toHaveAttribute("title");
	});

	it("shows the known composition labels when a stored variant id can no longer be resolved", () => {
		renderCard({
			mixes: [mixRow({ games: ["v-1", "v-missing"] })],
		});
		expect(screen.getByText("2 games: Limit Hold'em")).toBeInTheDocument();
	});

	it("shows the empty-state message when there are no mixes", () => {
		renderCard({ mixes: [] });
		expect(screen.getByText("No mixes yet.")).toBeInTheDocument();
	});

	it("does not render the empty-state message when mixes are present", () => {
		renderCard();
		expect(screen.queryByText("No mixes yet.")).not.toBeInTheDocument();
	});

	it("calls onEditMix with the mix when its edit button is clicked", async () => {
		const user = userEvent.setup();
		const mix = mixRow();
		const { onEditMix } = renderCard({ mixes: [mix] });
		await user.click(screen.getByRole("button", { name: "Edit HORSE" }));
		expect(onEditMix).toHaveBeenCalledTimes(1);
		expect(onEditMix).toHaveBeenNthCalledWith(1, mix);
	});

	it("calls onDeleteMix with the mix when its delete button is clicked", async () => {
		const user = userEvent.setup();
		const mix = mixRow();
		const { onDeleteMix } = renderCard({ mixes: [mix] });
		await user.click(screen.getByRole("button", { name: "Delete HORSE" }));
		expect(onDeleteMix).toHaveBeenCalledTimes(1);
		expect(onDeleteMix).toHaveBeenNthCalledWith(1, mix);
	});

	it("renders the delete button in a constant destructive color", () => {
		renderCard();
		const deleteButton = screen.getByRole("button", { name: "Delete HORSE" });
		expect(deleteButton).toHaveClass("text-destructive");
	});

	it("renders one row per mix", () => {
		renderCard({
			mixes: [
				mixRow({ id: "m-1", label: "HORSE" }),
				mixRow({ id: "m-2", label: "8-Game" }),
			],
		});
		expect(screen.getByText("HORSE")).toBeInTheDocument();
		expect(screen.getByText("8-Game")).toBeInTheDocument();
	});
});
