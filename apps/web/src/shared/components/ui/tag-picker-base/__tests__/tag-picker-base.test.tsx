import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagPickerBase } from "../tag-picker-base";

const NIT_TAG = { id: "nit", name: "Nit" };

describe("TagPickerBase inline variant", () => {
	it("renders suggestions in place, without a Portal", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<TagPickerBase
				availableTags={[NIT_TAG]}
				onAdd={vi.fn()}
				onRemove={vi.fn()}
				renderSelectedTag={(tag, onRemove) => (
					<button onClick={onRemove} type="button">
						{tag.name}
					</button>
				)}
				renderSuggestion={(tag) => tag.name}
				searchAriaLabel="Add labels"
				selectedTags={[]}
				variant="inline"
			/>
		);

		await user.click(screen.getByLabelText("Add labels"));

		const suggestion = await screen.findByRole("button", { name: "Nit" });
		expect(container).toContainElement(suggestion);
	});

	it("closes the suggestion list when focus leaves the widget", async () => {
		const user = userEvent.setup();
		render(
			<div>
				<TagPickerBase
					availableTags={[NIT_TAG]}
					onAdd={vi.fn()}
					onRemove={vi.fn()}
					renderSelectedTag={(tag, onRemove) => (
						<button onClick={onRemove} type="button">
							{tag.name}
						</button>
					)}
					renderSuggestion={(tag) => tag.name}
					searchAriaLabel="Add labels"
					selectedTags={[]}
					variant="inline"
				/>
				<button type="button">Elsewhere</button>
			</div>
		);

		await user.click(screen.getByLabelText("Add labels"));
		await screen.findByRole("button", { name: "Nit" });

		await user.click(screen.getByRole("button", { name: "Elsewhere" }));

		expect(
			screen.queryByRole("button", { name: "Nit" })
		).not.toBeInTheDocument();
	});

	it("does not add a tag on Enter, only from the create row", async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();
		const onCreateTag = vi.fn(async (name: string) => ({ id: name, name }));

		render(
			<TagPickerBase
				availableTags={[NIT_TAG]}
				onAdd={onAdd}
				onCreateTag={onCreateTag}
				onRemove={vi.fn()}
				renderSelectedTag={(tag, onRemove) => (
					<button onClick={onRemove} type="button">
						{tag.name}
					</button>
				)}
				renderSuggestion={(tag) => tag.name}
				searchAriaLabel="Add labels"
				selectedTags={[]}
				variant="inline"
			/>
		);

		await user.type(screen.getByLabelText("Add labels"), "Fish");
		await user.keyboard("{Enter}");

		expect(onCreateTag).not.toHaveBeenCalled();
		expect(onAdd).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: 'Create "Fish"' }));

		expect(onCreateTag).toHaveBeenCalledWith("Fish");
		expect(onAdd).toHaveBeenCalledWith({ id: "Fish", name: "Fish" });
	});
});
