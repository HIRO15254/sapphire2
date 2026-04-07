import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerCard } from "../player-card";

const taggedPlayer = {
	createdAt: "2026-04-01T10:00:00Z",
	id: "player-1",
	memo: "<p><strong>Regular</strong> in the weekday game.</p>",
	name: "Alice",
	tags: [
		{ color: "blue", id: "vip", name: "VIP" },
		{ color: "red", id: "reg", name: "Regular" },
	],
	updatedAt: "2026-04-01T10:00:00Z",
	userId: "user-1",
};

describe("PlayerCard", () => {
	it("renders the player summary with tags and memo icon", () => {
		const { container } = render(
			<PlayerCard onDelete={vi.fn()} onEdit={vi.fn()} player={taggedPlayer} />
		);

		expect(screen.getByText("Alice")).toBeInTheDocument();
		expect(screen.getByText("VIP")).toBeInTheDocument();
		expect(screen.getByText("Regular")).toBeInTheDocument();
		expect(container.querySelector("svg")).not.toBeNull();
	});

	it("expands to show sanitized memo content", async () => {
		const user = userEvent.setup();

		render(
			<PlayerCard onDelete={vi.fn()} onEdit={vi.fn()} player={taggedPlayer} />
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByText("in the weekday game.")).toBeInTheDocument();
	});

	it("shows the memo empty state when no memo exists", async () => {
		const user = userEvent.setup();

		render(
			<PlayerCard
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				player={{ ...taggedPlayer, memo: null, tags: [] }}
			/>
		);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByText("No memo yet.")).toBeInTheDocument();
	});

	it("calls onEdit and onDelete from the shared footer actions", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		const onEdit = vi.fn();

		render(
			<PlayerCard onDelete={onDelete} onEdit={onEdit} player={taggedPlayer} />
		);

		await user.click(screen.getByRole("button", { expanded: false }));
		await user.click(screen.getByRole("button", { name: "Edit" }));
		expect(onEdit).toHaveBeenCalledWith(taggedPlayer);

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(screen.getByText("Delete this player?")).toBeInTheDocument();

		await user.click(screen.getByLabelText("Confirm delete"));
		expect(onDelete).toHaveBeenCalledWith("player-1");
	});
});
