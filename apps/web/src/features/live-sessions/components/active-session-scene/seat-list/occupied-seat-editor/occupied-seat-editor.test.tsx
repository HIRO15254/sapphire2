import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	detail: {
		availableTags: [{ color: "#123456", id: "t1", name: "Fish" }],
		createTag: vi.fn(),
		isSaving: false,
		player: {
			id: "p-1",
			memo: "old memo",
			name: "Alice",
			tags: [],
		} as {
			id: string;
			memo: string | null;
			name: string;
			tags: unknown[];
		} | null,
		updatePlayer: vi.fn(),
	},
	usePlayerDetailSpy: vi.fn(),
}));

vi.mock("@/features/players/hooks/use-player-detail", () => ({
	usePlayerDetail: (playerId: string | null) => {
		mocks.usePlayerDetailSpy(playerId);
		return mocks.detail;
	},
}));

// Render the real PlayerForm but stub its heavy tag-picker dependency surface
// is unnecessary — PlayerForm is light enough to render directly.
import { OccupiedSeatEditor } from "@/features/live-sessions/components/active-session-scene/seat-list/occupied-seat-editor";

describe("OccupiedSeatEditor", () => {
	beforeEach(() => {
		mocks.usePlayerDetailSpy.mockReset();
		mocks.detail.updatePlayer.mockReset();
		mocks.detail.isSaving = false;
		mocks.detail.player = {
			id: "p-1",
			memo: "old memo",
			name: "Alice",
			tags: [],
		};
	});

	it("loads the detail for the given playerId", () => {
		render(
			<OccupiedSeatEditor onRemove={vi.fn()} onSaved={vi.fn()} playerId="p-1" />
		);
		expect(mocks.usePlayerDetailSpy).toHaveBeenCalledWith("p-1");
	});

	it("pre-fills the form with the player's current name", () => {
		render(
			<OccupiedSeatEditor onRemove={vi.fn()} onSaved={vi.fn()} playerId="p-1" />
		);
		expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
	});

	it("saving persists the edited name and calls onSaved", async () => {
		const user = userEvent.setup();
		const onSaved = vi.fn();
		render(
			<OccupiedSeatEditor onRemove={vi.fn()} onSaved={onSaved} playerId="p-1" />
		);
		const nameInput = screen.getByDisplayValue("Alice");
		await user.clear(nameInput);
		await user.type(nameInput, "Alice 2");
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(mocks.detail.updatePlayer).toHaveBeenCalledTimes(1);
		expect(mocks.detail.updatePlayer).toHaveBeenCalledWith(
			expect.objectContaining({ id: "p-1", name: "Alice 2" })
		);
		expect(onSaved).toHaveBeenCalledTimes(1);
	});

	it("'Leave seat' invokes onRemove without saving", async () => {
		const user = userEvent.setup();
		const onRemove = vi.fn();
		render(
			<OccupiedSeatEditor
				onRemove={onRemove}
				onSaved={vi.fn()}
				playerId="p-1"
			/>
		);
		await user.click(screen.getByRole("button", { name: "Leave seat" }));
		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
	});

	it("disables Save while a save is in flight", () => {
		mocks.detail.isSaving = true;
		render(
			<OccupiedSeatEditor onRemove={vi.fn()} onSaved={vi.fn()} playerId="p-1" />
		);
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
	});
});
