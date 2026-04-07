import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AddPlayerSheet } from "../add-player-sheet";

const ALICE_NAME_PATTERN = /alice/i;
const BOB_NAME_PATTERN = /bob/i;
const NAME_LABEL_PATTERN = /name/i;

const mocks = vi.hoisted(() => ({
	players: [] as Array<{ id: string; memo: string | null; name: string }>,
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		data: mocks.players,
	}),
}));

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		open,
		title,
	}: {
		children: ReactNode;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{children}
			</div>
		) : null,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			list: {
				queryOptions: () => ({}),
			},
		},
	},
}));

describe("AddPlayerSheet", () => {
	it("filters existing players by search text", async () => {
		const user = userEvent.setup();
		mocks.players = [
			{ id: "p1", memo: "Aggro", name: "Alice" },
			{ id: "p2", memo: "Tight", name: "Bob" },
		];

		render(
			<AddPlayerSheet
				excludePlayerIds={[]}
				onAddExisting={vi.fn()}
				onAddNew={vi.fn()}
				onOpenChange={vi.fn()}
				open
			/>
		);

		await user.type(screen.getByLabelText("Search players"), "bo");

		expect(
			screen.queryByRole("button", { name: ALICE_NAME_PATTERN })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: BOB_NAME_PATTERN })
		).toBeInTheDocument();
	});

	it("shows the empty state when no selectable players remain", () => {
		mocks.players = [{ id: "p1", memo: null, name: "Alice" }];

		render(
			<AddPlayerSheet
				excludePlayerIds={["p1"]}
				onAddExisting={vi.fn()}
				onAddNew={vi.fn()}
				onOpenChange={vi.fn()}
				open
			/>
		);

		expect(screen.getByText("No available players")).toBeInTheDocument();
	});

	it("selects an existing player and closes the sheet", async () => {
		const user = userEvent.setup();
		const onAddExisting = vi.fn();
		const onOpenChange = vi.fn();
		mocks.players = [{ id: "p1", memo: "Aggro", name: "Alice" }];

		render(
			<AddPlayerSheet
				excludePlayerIds={[]}
				onAddExisting={onAddExisting}
				onAddNew={vi.fn()}
				onOpenChange={onOpenChange}
				open
			/>
		);

		await user.click(screen.getByRole("button", { name: ALICE_NAME_PATTERN }));

		expect(onAddExisting).toHaveBeenCalledWith("p1", "Alice");
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("submits a new player with memo text", async () => {
		const user = userEvent.setup();
		const onAddNew = vi.fn();
		const onOpenChange = vi.fn();
		mocks.players = [];

		render(
			<AddPlayerSheet
				excludePlayerIds={[]}
				onAddExisting={vi.fn()}
				onAddNew={onAddNew}
				onOpenChange={onOpenChange}
				open
			/>
		);

		await user.click(screen.getByRole("tab", { name: "New Player" }));
		await user.type(screen.getByLabelText(NAME_LABEL_PATTERN), "New Hero");
		await user.type(screen.getByLabelText("Memo (optional)"), "Late reg");
		await user.click(screen.getByRole("button", { name: "Add Player" }));

		expect(onAddNew).toHaveBeenCalledWith("New Hero", "Late reg");
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
