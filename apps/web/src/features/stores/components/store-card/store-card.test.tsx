import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StoreCard } from "./store-card";

vi.mock("@/features/stores/components/ring-game-tab", () => ({
	RingGameTab: () => <div>Cash Games Content</div>,
}));

vi.mock("@/features/stores/components/tournament-tab", () => ({
	TournamentTab: () => <div>Tournaments Content</div>,
}));

const store = {
	id: "store-1",
	memo: "Late-night cash and weekly tournaments",
	name: "Akiba Poker Room",
};

describe("StoreCard", () => {
	it("renders the store summary", () => {
		render(<StoreCard onDelete={vi.fn()} onEdit={vi.fn()} store={store} />);

		expect(screen.getByText("Akiba Poker Room")).toBeInTheDocument();
		expect(
			screen.getByText("Late-night cash and weekly tournaments")
		).toBeInTheDocument();
	});

	it("expands to show embedded management tabs", async () => {
		const user = userEvent.setup();

		render(<StoreCard onDelete={vi.fn()} onEdit={vi.fn()} store={store} />);

		await user.click(screen.getByRole("button", { expanded: false }));

		expect(screen.getByText("Cash Games Content")).toBeInTheDocument();
		expect(screen.getByText("Tournaments Content")).toBeInTheDocument();
	});

	it("cancels a delete after the confirmation prompt appears", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();

		render(<StoreCard onDelete={onDelete} onEdit={vi.fn()} store={store} />);

		await user.click(screen.getByRole("button", { expanded: false }));
		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(screen.getByText("Delete this store?")).toBeInTheDocument();

		await user.click(screen.getByLabelText("Cancel delete"));
		expect(onDelete).not.toHaveBeenCalled();
		expect(screen.queryByText("Delete this store?")).not.toBeInTheDocument();
	});

	it("renders without a memo when the store memo is empty", () => {
		render(
			<StoreCard
				onDelete={vi.fn()}
				onEdit={vi.fn()}
				store={{ ...store, memo: "" }}
			/>
		);
		// Name still renders.
		expect(screen.getByText("Akiba Poker Room")).toBeInTheDocument();
		expect(
			screen.queryByText("Late-night cash and weekly tournaments")
		).not.toBeInTheDocument();
	});

	it("calls onEdit and onDelete from the shared footer actions", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		const onEdit = vi.fn();

		render(<StoreCard onDelete={onDelete} onEdit={onEdit} store={store} />);

		await user.click(screen.getByRole("button", { expanded: false }));
		await user.click(screen.getByRole("button", { name: "Edit" }));
		expect(onEdit).toHaveBeenCalledWith(store);

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(screen.getByText("Delete this store?")).toBeInTheDocument();

		await user.click(screen.getByLabelText("Confirm delete"));
		expect(onDelete).toHaveBeenCalledWith("store-1");
	});
});
