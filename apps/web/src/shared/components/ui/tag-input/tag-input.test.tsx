import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagInput } from "./tag-input";

const SERIES_TAG = { id: "series", name: "Series" };
const DAILY_TAG = { id: "daily", name: "Daily" };
const VIP_TAG = { id: "vip", name: "VIP" };

describe("TagInput", () => {
	it("adds an existing tag when the exact name is submitted", async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();

		render(
			<TagInput
				availableTags={[SERIES_TAG, DAILY_TAG]}
				onAdd={onAdd}
				onRemove={vi.fn()}
				selectedTags={[]}
			/>
		);

		await user.type(screen.getByLabelText("Search tags"), "Series");
		await user.keyboard("{Enter}");

		expect(onAdd).toHaveBeenCalledWith(SERIES_TAG);
	});

	it("creates a new tag when no exact match exists", async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();
		const onCreateTag = vi.fn(async (name: string) => ({
			id: name.toLowerCase(),
			name,
		}));

		render(
			<TagInput
				availableTags={[SERIES_TAG]}
				onAdd={onAdd}
				onCreateTag={onCreateTag}
				onRemove={vi.fn()}
				selectedTags={[]}
			/>
		);

		await user.type(screen.getByLabelText("Search tags"), "VIP");
		await user.keyboard("{Enter}");

		expect(onCreateTag).toHaveBeenCalledWith("VIP");
		expect(onAdd).toHaveBeenCalledWith(VIP_TAG);
	});

	it("removes a selected tag", async () => {
		const user = userEvent.setup();
		const onRemove = vi.fn();

		render(
			<TagInput
				availableTags={[SERIES_TAG]}
				onAdd={vi.fn()}
				onRemove={onRemove}
				selectedTags={[SERIES_TAG]}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Remove tag Series" }));

		expect(onRemove).toHaveBeenCalledWith(SERIES_TAG);
	});

	it("closes the suggestion list on escape", async () => {
		const user = userEvent.setup();

		render(
			<TagInput
				availableTags={[SERIES_TAG]}
				onAdd={vi.fn()}
				onRemove={vi.fn()}
				selectedTags={[]}
			/>
		);

		const input = screen.getByLabelText("Search tags");
		await user.click(input);
		expect(screen.getByText("Series")).toBeInTheDocument();

		await user.keyboard("{Escape}");

		expect(screen.queryByText("Series")).not.toBeInTheDocument();
	});
});
