import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
	GameGroupEntry,
	GameGroupRow,
	GameVariantRow,
} from "../../use-game-library-section";
import { GroupCard, type GroupCardProps } from "../group-card";

function groupRow(overrides: Partial<GameGroupRow> = {}): GameGroupRow {
	return {
		id: "g-1",
		builtinKey: "nlh",
		label: "No Limit Hold'em",
		blind1Label: null,
		blind2Label: null,
		blind3Label: null,
		...overrides,
	};
}

function variantRow(overrides: Partial<GameVariantRow> = {}): GameVariantRow {
	return {
		id: "v-1",
		builtinKey: null,
		label: "Big Duck",
		shortLabel: "BD",
		groupId: "g-1",
		sortOrder: 0,
		...overrides,
	};
}

function renderCard(overrides: Partial<{ entry: GameGroupEntry }> = {}) {
	const props: GroupCardProps = {
		entry: overrides.entry ?? { group: groupRow(), variants: [] },
		onAddVariant: vi.fn(),
		onDeleteGroup: vi.fn(),
		onDeleteVariant: vi.fn(),
		onEditGroup: vi.fn(),
		onEditVariant: vi.fn(),
	};
	render(<GroupCard {...props} />);
	return props;
}

describe("GroupCard", () => {
	it("renders the group label and its slot-labels summary in the header band", () => {
		renderCard();
		expect(screen.getByText("No Limit Hold'em")).toBeInTheDocument();
		expect(screen.getByText("Default labels")).toBeInTheDocument();
	});

	it("never renders a Default badge, even for a builtin group", () => {
		renderCard();
		expect(screen.queryByText("Default")).not.toBeInTheDocument();
	});

	it("omits any badge for a user-created group", () => {
		renderCard({
			entry: { group: groupRow({ builtinKey: null }), variants: [] },
		});
		expect(screen.queryByText("Default")).not.toBeInTheDocument();
	});

	it("joins non-null slot labels with a slash", () => {
		renderCard({
			entry: {
				group: groupRow({
					blind1Label: "Small blind",
					blind2Label: "Big blind",
				}),
				variants: [],
			},
		});
		expect(screen.getByText("Small blind / Big blind")).toBeInTheDocument();
	});

	it("falls back to 'Default labels' when every slot label is null", () => {
		renderCard();
		expect(screen.getByText("Default labels")).toBeInTheDocument();
	});

	it("shows the empty-group message when there are no variants", () => {
		renderCard();
		expect(
			screen.getByText("No variants in this group yet.")
		).toBeInTheDocument();
	});

	it("renders each variant's label and short label without a Default badge, even for a builtin variant", () => {
		renderCard({
			entry: {
				group: groupRow(),
				variants: [variantRow({ builtinKey: "nlh" })],
			},
		});
		expect(screen.getByText("Big Duck")).toBeInTheDocument();
		expect(screen.getByText("BD")).toBeInTheDocument();
		expect(screen.queryByText("Default")).not.toBeInTheDocument();
	});

	it("does not render an empty-group message when variants are present", () => {
		renderCard({ entry: { group: groupRow(), variants: [variantRow()] } });
		expect(
			screen.queryByText("No variants in this group yet.")
		).not.toBeInTheDocument();
	});

	it("calls onEditGroup with the group when the group edit button is clicked", async () => {
		const user = userEvent.setup();
		const group = groupRow();
		const { onEditGroup } = renderCard({ entry: { group, variants: [] } });
		await user.click(
			screen.getByRole("button", { name: "Edit No Limit Hold'em" })
		);
		expect(onEditGroup).toHaveBeenCalledTimes(1);
		expect(onEditGroup).toHaveBeenNthCalledWith(1, group);
	});

	it("calls onDeleteGroup with the group when the group delete button is clicked", async () => {
		const user = userEvent.setup();
		const group = groupRow();
		const { onDeleteGroup } = renderCard({ entry: { group, variants: [] } });
		const deleteButton = screen.getByRole("button", {
			name: "Delete No Limit Hold'em",
		});
		await user.click(deleteButton);
		expect(onDeleteGroup).toHaveBeenCalledTimes(1);
		expect(onDeleteGroup).toHaveBeenNthCalledWith(1, group);
	});

	it("renders the group delete button in a constant destructive color", () => {
		renderCard();
		const deleteButton = screen.getByRole("button", {
			name: "Delete No Limit Hold'em",
		});
		expect(deleteButton).toHaveClass("text-destructive");
	});

	it("calls onEditVariant with the variant when its edit button is clicked", async () => {
		const user = userEvent.setup();
		const variant = variantRow();
		const { onEditVariant } = renderCard({
			entry: { group: groupRow(), variants: [variant] },
		});
		await user.click(screen.getByRole("button", { name: "Edit Big Duck" }));
		expect(onEditVariant).toHaveBeenCalledTimes(1);
		expect(onEditVariant).toHaveBeenNthCalledWith(1, variant);
	});

	it("calls onDeleteVariant with the variant when its delete button is clicked", async () => {
		const user = userEvent.setup();
		const variant = variantRow();
		const { onDeleteVariant } = renderCard({
			entry: { group: groupRow(), variants: [variant] },
		});
		await user.click(screen.getByRole("button", { name: "Delete Big Duck" }));
		expect(onDeleteVariant).toHaveBeenCalledTimes(1);
		expect(onDeleteVariant).toHaveBeenNthCalledWith(1, variant);
	});

	it("renders the variant delete button in a constant destructive color", () => {
		renderCard({ entry: { group: groupRow(), variants: [variantRow()] } });
		const deleteButton = screen.getByRole("button", {
			name: "Delete Big Duck",
		});
		expect(deleteButton).toHaveClass("text-destructive");
	});

	it("calls onAddVariant with the group's id when Add variant is clicked", async () => {
		const user = userEvent.setup();
		const group = groupRow();
		const { onAddVariant } = renderCard({ entry: { group, variants: [] } });
		await user.click(screen.getByRole("button", { name: "Add variant" }));
		expect(onAddVariant).toHaveBeenCalledTimes(1);
		expect(onAddVariant).toHaveBeenNthCalledWith(1, "g-1");
	});
});
