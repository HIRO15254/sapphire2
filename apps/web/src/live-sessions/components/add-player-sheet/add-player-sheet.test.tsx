import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AddPlayerSheet } from "./add-player-sheet";

const ALICE_NAME_PATTERN = /alice/i;
const BOB_NAME_PATTERN = /bob/i;
const CREATE_NEW_HERO_PATTERN = /create "new hero"/i;
const ADD_TEMPORARY_PATTERN = /Add Temporary Player/;

const mocks = vi.hoisted(() => ({
	players: [] as Array<{
		id: string;
		memo: string | null;
		name: string;
		tags: Array<{ color: string; id: string; name: string }>;
	}>,
}));

vi.mock("@tanstack/react-query", () => ({
	keepPreviousData: (prev: unknown) => prev,
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

vi.mock("@/players/components/player-tag-input", () => ({
	PlayerTagInput: () => null,
}));

vi.mock("@/players/components/player-avatar", () => ({
	PlayerAvatar: () => <div data-testid="player-avatar" />,
}));

vi.mock("@/players/components/color-badge", () => ({
	ColorBadge: ({ children }: { children: React.ReactNode; color: string }) => (
		<span>{children}</span>
	),
}));

describe("AddPlayerSheet", () => {
	it("calls onAddTemporary and closes the sheet when the button is clicked", async () => {
		const user = userEvent.setup();
		const onAddTemporary = vi.fn();
		const onOpenChange = vi.fn();
		mocks.players = [];

		render(
			<AddPlayerSheet
				availableTags={[]}
				excludePlayerIds={[]}
				onAddExisting={vi.fn()}
				onAddNew={vi.fn()}
				onAddTemporary={onAddTemporary}
				onCreateTag={vi.fn()}
				onOpenChange={onOpenChange}
				open
			/>
		);

		await user.click(
			screen.getByRole("button", { name: ADD_TEMPORARY_PATTERN })
		);

		expect(onAddTemporary).toHaveBeenCalledOnce();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("excludes already-seated players from the list", () => {
		mocks.players = [
			{ id: "p1", memo: "Aggro", name: "Alice", tags: [] },
			{ id: "p2", memo: "Tight", name: "Bob", tags: [] },
		];

		render(
			<AddPlayerSheet
				availableTags={[]}
				excludePlayerIds={["p1"]}
				onAddExisting={vi.fn()}
				onAddNew={vi.fn()}
				onAddTemporary={vi.fn()}
				onCreateTag={vi.fn()}
				onOpenChange={vi.fn()}
				open
			/>
		);

		expect(
			screen.queryByRole("button", { name: ALICE_NAME_PATTERN })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: BOB_NAME_PATTERN })
		).toBeInTheDocument();
	});

	it("shows the empty state when no selectable players remain", () => {
		mocks.players = [{ id: "p1", memo: null, name: "Alice", tags: [] }];

		render(
			<AddPlayerSheet
				availableTags={[]}
				excludePlayerIds={["p1"]}
				onAddExisting={vi.fn()}
				onAddNew={vi.fn()}
				onAddTemporary={vi.fn()}
				onCreateTag={vi.fn()}
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
		mocks.players = [{ id: "p1", memo: "Aggro", name: "Alice", tags: [] }];

		render(
			<AddPlayerSheet
				availableTags={[]}
				excludePlayerIds={[]}
				onAddExisting={onAddExisting}
				onAddNew={vi.fn()}
				onAddTemporary={vi.fn()}
				onCreateTag={vi.fn()}
				onOpenChange={onOpenChange}
				open
			/>
		);

		await user.click(screen.getByRole("button", { name: ALICE_NAME_PATTERN }));

		expect(onAddExisting).toHaveBeenCalledWith("p1", "Alice");
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("creates a new player via the create option", async () => {
		const user = userEvent.setup();
		const onAddNew = vi.fn();
		const onOpenChange = vi.fn();
		mocks.players = [];

		render(
			<AddPlayerSheet
				availableTags={[]}
				excludePlayerIds={[]}
				onAddExisting={vi.fn()}
				onAddNew={onAddNew}
				onAddTemporary={vi.fn()}
				onCreateTag={vi.fn()}
				onOpenChange={onOpenChange}
				open
			/>
		);

		await user.type(screen.getByLabelText("Search players"), "New Hero");
		await user.click(
			screen.getByRole("button", { name: CREATE_NEW_HERO_PATTERN })
		);

		expect(onAddNew).toHaveBeenCalledWith({
			name: "New Hero",
			tagIds: undefined,
		});
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("displays tags on player items", () => {
		mocks.players = [
			{
				id: "p1",
				memo: null,
				name: "Alice",
				tags: [
					{ color: "red", id: "t1", name: "Regular" },
					{ color: "blue", id: "t2", name: "Aggressive" },
				],
			},
		];

		render(
			<AddPlayerSheet
				availableTags={[]}
				excludePlayerIds={[]}
				onAddExisting={vi.fn()}
				onAddNew={vi.fn()}
				onAddTemporary={vi.fn()}
				onCreateTag={vi.fn()}
				onOpenChange={vi.fn()}
				open
			/>
		);

		expect(screen.getByText("Regular")).toBeInTheDocument();
		expect(screen.getByText("Aggressive")).toBeInTheDocument();
	});
});
