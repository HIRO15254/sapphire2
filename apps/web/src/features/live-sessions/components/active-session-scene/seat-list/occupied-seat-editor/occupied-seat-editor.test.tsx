import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerDetailData } from "@/features/players/hooks/use-player-detail";

const mocks = vi.hoisted(() => ({
	detail: {
		availableTags: [
			{ color: "gray", id: "t1", name: "Fish" },
			{ color: "red", id: "t2", name: "Reg" },
		],
		createTag: vi.fn(),
		isSaving: false,
		player: null as PlayerDetailData | null,
		updatePlayer: vi.fn(),
	},
}));

vi.mock("@/features/players/hooks/use-player-detail", () => ({
	usePlayerDetail: () => mocks.detail,
}));

// The shared tag picker is exercised elsewhere; here assert the seat editor
// wires it to the player's tags and handlers.
vi.mock("@/features/players/components/player-tag-input", () => ({
	PlayerTagInput: ({
		onAdd,
		onRemove,
		selectedTags,
	}: {
		onAdd: (tag: { color: string; id: string; name: string }) => void;
		onRemove: (tag: { color: string; id: string; name: string }) => void;
		selectedTags: { color: string; id: string; name: string }[];
	}) => (
		<div data-testid="tag-input">
			<span>selected:{selectedTags.map((t) => t.name).join(",")}</span>
			<button
				onClick={() => onAdd({ color: "red", id: "t2", name: "Reg" })}
				type="button"
			>
				add-tag
			</button>
			<button onClick={() => onRemove(selectedTags[0])} type="button">
				remove-tag
			</button>
		</div>
	),
}));

vi.mock("@/shared/components/ui/rich-text-editor", () => ({
	RichTextEditor: ({ onChange }: { onChange: (html: string) => void }) => (
		<button
			data-testid="memo-editor"
			onClick={() => onChange("<p>edited</p>")}
			type="button"
		>
			memo
		</button>
	),
}));

import { OccupiedSeatEditor } from "@/features/live-sessions/components/active-session-scene/seat-list/occupied-seat-editor";

describe("OccupiedSeatEditor", () => {
	beforeEach(() => {
		mocks.detail.player = {
			id: "p-1",
			memo: "<p>old</p>",
			name: "Alice",
			tags: [{ color: "gray", id: "t1", name: "Fish" }],
		};
		mocks.detail.isSaving = false;
		mocks.detail.updatePlayer.mockReset();
	});

	it("shows a loading hint until the player detail arrives", () => {
		mocks.detail.player = null;
		render(<OccupiedSeatEditor playerId="p-1" />);
		expect(screen.getByText("Loading...")).toBeInTheDocument();
	});

	it("pre-fills the name input", () => {
		render(<OccupiedSeatEditor playerId="p-1" />);
		expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
	});

	it("saves an edited name when the input loses focus", async () => {
		const user = userEvent.setup();
		render(<OccupiedSeatEditor playerId="p-1" />);
		const input = screen.getByLabelText("Player name");
		await user.clear(input);
		await user.type(input, "Alice 2");
		await user.tab();
		expect(mocks.detail.updatePlayer).toHaveBeenCalledTimes(1);
		expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
			id: "p-1",
			name: "Alice 2",
		});
	});

	it("passes the player's tags to the shared tag picker", () => {
		render(<OccupiedSeatEditor playerId="p-1" />);
		expect(screen.getByTestId("tag-input")).toHaveTextContent("selected:Fish");
	});

	it("adding a tag from the picker saves the player with it", async () => {
		const user = userEvent.setup();
		render(<OccupiedSeatEditor playerId="p-1" />);
		await user.click(screen.getByRole("button", { name: "add-tag" }));
		expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
			id: "p-1",
			tagIds: ["t1", "t2"],
		});
	});

	it("removing a tag from the picker saves the player without it", async () => {
		const user = userEvent.setup();
		render(<OccupiedSeatEditor playerId="p-1" />);
		await user.click(screen.getByRole("button", { name: "remove-tag" }));
		expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
			id: "p-1",
			tagIds: [],
		});
	});

	it("saves the memo when focus leaves the memo editor", async () => {
		const user = userEvent.setup();
		render(<OccupiedSeatEditor playerId="p-1" />);
		await user.click(screen.getByTestId("memo-editor"));
		await user.tab();
		expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
			id: "p-1",
			memo: "<p>edited</p>",
		});
	});

	it("shows a saving spinner while a write is in flight", () => {
		mocks.detail.isSaving = true;
		render(<OccupiedSeatEditor playerId="p-1" />);
		expect(screen.getByLabelText("Saving")).toBeInTheDocument();
	});
});
