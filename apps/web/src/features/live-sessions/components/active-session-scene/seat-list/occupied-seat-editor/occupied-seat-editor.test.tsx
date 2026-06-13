import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerDetailData } from "@/features/players/hooks/use-player-detail";

const mocks = vi.hoisted(() => ({
	detail: {
		availableTags: [
			{ color: "#111111", id: "t1", name: "Fish" },
			{ color: "#222222", id: "t2", name: "Reg" },
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
			tags: [{ color: "#111111", id: "t1", name: "Fish" }],
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

	it("marks the player's tags as pressed chips", () => {
		render(<OccupiedSeatEditor playerId="p-1" />);
		expect(screen.getByRole("button", { name: "Fish" })).toHaveAttribute(
			"aria-pressed",
			"true"
		);
		expect(screen.getByRole("button", { name: "Reg" })).toHaveAttribute(
			"aria-pressed",
			"false"
		);
	});

	it("tapping an unselected tag chip saves it instantly", async () => {
		const user = userEvent.setup();
		render(<OccupiedSeatEditor playerId="p-1" />);
		await user.click(screen.getByRole("button", { name: "Reg" }));
		expect(mocks.detail.updatePlayer).toHaveBeenCalledTimes(1);
		expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
			id: "p-1",
			tagIds: ["t1", "t2"],
		});
	});

	it("tapping a selected tag chip removes it instantly", async () => {
		const user = userEvent.setup();
		render(<OccupiedSeatEditor playerId="p-1" />);
		await user.click(screen.getByRole("button", { name: "Fish" }));
		expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
			id: "p-1",
			tagIds: [],
		});
	});

	it("creates and assigns a brand-new tag from the inline input", async () => {
		const user = userEvent.setup();
		mocks.detail.createTag.mockResolvedValue({
			color: "#333333",
			id: "t-new",
			name: "Whale",
		});
		render(<OccupiedSeatEditor playerId="p-1" />);
		await user.type(screen.getByLabelText("New tag name"), "Whale");
		await user.click(screen.getByRole("button", { name: "Create tag" }));
		expect(mocks.detail.createTag).toHaveBeenCalledWith("Whale");
		expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
			id: "p-1",
			tagIds: ["t1", "t-new"],
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
