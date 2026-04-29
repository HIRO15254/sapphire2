import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerTagInput } from "./player-tag-input";

const VIP_TAG = { color: "blue", id: "vip", name: "VIP" };
const REG_TAG = { color: "red", id: "reg", name: "Regular" };
const SHARK_TAG = { color: "green", id: "shark", name: "Shark" };

describe("PlayerTagInput", () => {
	it("adds an existing colored tag from the suggestion list", async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();

		render(
			<PlayerTagInput
				availableTags={[VIP_TAG, REG_TAG]}
				onAdd={onAdd}
				onRemove={vi.fn()}
				selectedTags={[]}
			/>
		);

		await user.type(screen.getByLabelText("Search player tags"), "VIP");
		await user.keyboard("{Enter}");

		expect(onAdd).toHaveBeenCalledWith(VIP_TAG);
	});

	it("creates a new colored tag when requested", async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();
		const onCreateTag = vi.fn(async (name: string) => ({
			color: "green",
			id: name.toLowerCase(),
			name,
		}));

		render(
			<PlayerTagInput
				availableTags={[VIP_TAG]}
				onAdd={onAdd}
				onCreateTag={onCreateTag}
				onRemove={vi.fn()}
				selectedTags={[]}
			/>
		);

		await user.type(screen.getByLabelText("Search player tags"), "Shark");
		await user.keyboard("{Enter}");

		expect(onCreateTag).toHaveBeenCalledWith("Shark");
		expect(onAdd).toHaveBeenCalledWith(SHARK_TAG);
	});

	it("does not call onAdd for a non-matching name when onCreateTag is not provided", async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();

		render(
			<PlayerTagInput
				availableTags={[VIP_TAG]}
				onAdd={onAdd}
				onRemove={vi.fn()}
				selectedTags={[]}
			/>
		);

		await user.type(screen.getByLabelText("Search player tags"), "Ghost");
		await user.keyboard("{Enter}");

		expect(onAdd).not.toHaveBeenCalled();
	});

	it("does not re-add a tag that is already selected", async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();

		render(
			<PlayerTagInput
				availableTags={[VIP_TAG, REG_TAG]}
				onAdd={onAdd}
				onRemove={vi.fn()}
				selectedTags={[VIP_TAG]}
			/>
		);

		await user.type(screen.getByLabelText("Search player tags"), "VIP");
		await user.keyboard("{Enter}");

		expect(onAdd).not.toHaveBeenCalled();
	});

	it("removes a selected colored tag", async () => {
		const user = userEvent.setup();
		const onRemove = vi.fn();

		render(
			<PlayerTagInput
				availableTags={[VIP_TAG]}
				onAdd={vi.fn()}
				onRemove={onRemove}
				selectedTags={[VIP_TAG]}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Remove tag VIP" }));

		expect(onRemove).toHaveBeenCalledWith(VIP_TAG);
	});
});
