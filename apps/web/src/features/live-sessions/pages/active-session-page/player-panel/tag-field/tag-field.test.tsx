import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerTagWithColor } from "@/features/players/hooks/use-player-detail";

const mocks = vi.hoisted(() => ({
	base: {
		filteredTags: [] as PlayerTagWithColor[],
		handleInputSubmit: vi.fn(),
		handleTagSelect: vi.fn(),
		inputValue: "",
		onInputChange: vi.fn(),
		onOpenChange: vi.fn(),
		shouldRenderPopover: false,
	},
}));

vi.mock("@/shared/components/ui/tag-picker-base/use-tag-picker-base", () => ({
	useTagPickerBase: () => mocks.base,
}));

import { TagField } from "./tag-field";

const SUGGESTION_NAME = /Nit/;

function makeTag(
	overrides: Partial<PlayerTagWithColor> = {}
): PlayerTagWithColor {
	return { color: "gray", id: "t1", name: "Fish", ...overrides };
}

describe("TagField", () => {
	beforeEach(() => {
		mocks.base.filteredTags = [];
		mocks.base.handleInputSubmit = vi.fn().mockResolvedValue(undefined);
		mocks.base.handleTagSelect = vi.fn();
		mocks.base.inputValue = "";
		mocks.base.onInputChange = vi.fn();
		mocks.base.onOpenChange = vi.fn();
		mocks.base.shouldRenderPopover = false;
	});

	it("renders a pill for each selected tag", () => {
		render(
			<TagField
				onAdd={vi.fn()}
				onRemove={vi.fn()}
				selectedTags={[
					makeTag({ id: "t1", name: "Fish" }),
					makeTag({ id: "t2", name: "Reg" }),
				]}
			/>
		);
		expect(screen.getByText("Fish")).toBeInTheDocument();
		expect(screen.getByText("Reg")).toBeInTheDocument();
	});

	it("calls onRemove with the tag when its remove button is clicked", async () => {
		const onRemove = vi.fn();
		const tag = makeTag({ id: "t1", name: "Fish" });
		const user = userEvent.setup();
		render(
			<TagField onAdd={vi.fn()} onRemove={onRemove} selectedTags={[tag]} />
		);
		await user.click(screen.getByRole("button", { name: "Remove tag Fish" }));
		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(onRemove).toHaveBeenNthCalledWith(1, tag);
	});

	it("shows the multi-tag placeholder when a tag is already selected", () => {
		render(
			<TagField onAdd={vi.fn()} onRemove={vi.fn()} selectedTags={[makeTag()]} />
		);
		expect(screen.getByPlaceholderText("Add label…")).toBeInTheDocument();
	});

	it("shows the empty-state placeholder when no tag is selected", () => {
		render(<TagField onAdd={vi.fn()} onRemove={vi.fn()} selectedTags={[]} />);
		expect(screen.getByPlaceholderText("Add labels…")).toBeInTheDocument();
	});

	it("does not render the suggestion dropdown when the popover is closed", () => {
		mocks.base.shouldRenderPopover = false;
		render(<TagField onAdd={vi.fn()} onRemove={vi.fn()} selectedTags={[]} />);
		expect(
			screen.queryByRole("button", { name: "Nit" })
		).not.toBeInTheDocument();
	});

	it("renders suggestion rows and selects one on click", async () => {
		mocks.base.shouldRenderPopover = true;
		mocks.base.filteredTags = [makeTag({ id: "t9", name: "Nit" })];
		const user = userEvent.setup();
		render(<TagField onAdd={vi.fn()} onRemove={vi.fn()} selectedTags={[]} />);
		await user.click(screen.getByRole("button", { name: SUGGESTION_NAME }));
		expect(mocks.base.handleTagSelect).toHaveBeenCalledTimes(1);
		expect(mocks.base.handleTagSelect).toHaveBeenNthCalledWith(
			1,
			mocks.base.filteredTags[0]
		);
	});

	it("shows the no-match hint when the popover is open with no suggestions", () => {
		mocks.base.shouldRenderPopover = true;
		mocks.base.filteredTags = [];
		render(<TagField onAdd={vi.fn()} onRemove={vi.fn()} selectedTags={[]} />);
		expect(
			screen.getByText("No match — press Enter to create")
		).toBeInTheDocument();
	});

	it("submits the query on Enter", async () => {
		mocks.base.shouldRenderPopover = true;
		const user = userEvent.setup();
		render(<TagField onAdd={vi.fn()} onRemove={vi.fn()} selectedTags={[]} />);
		screen.getByRole("textbox").focus();
		await user.keyboard("{Enter}");
		expect(mocks.base.handleInputSubmit).toHaveBeenCalledTimes(1);
	});
});
