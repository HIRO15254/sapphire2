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

vi.mock("./tag-field", () => ({
	TagField: ({
		onAdd,
		onRemove,
		selectedTags,
	}: {
		onAdd: (tag: { color: string; id: string; name: string }) => void;
		onRemove: (tag: { color: string; id: string; name: string }) => void;
		selectedTags: { color: string; id: string; name: string }[];
	}) => (
		<div data-testid="tag-field">
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

import { PlayerPanel } from "./player-panel";
import type { PlayerPanelSelection } from "./use-player-panel";

const LEAVE_BUTTON_NAME = /leave/i;

function makeSelection(
	overrides: Partial<PlayerPanelSelection> = {}
): PlayerPanelSelection {
	return {
		playerId: "p-1",
		playerName: "Alice",
		seatPosition: 2,
		...overrides,
	};
}

describe("PlayerPanel", () => {
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

	it("shows the empty-state hint when no seat is selected", () => {
		render(<PlayerPanel isPaused={false} onLeave={vi.fn()} selection={null} />);
		expect(
			screen.getByText("Tap a seated player to edit their profile here")
		).toBeInTheDocument();
	});

	it("does not render the name input in the empty state", () => {
		render(<PlayerPanel isPaused={false} onLeave={vi.fn()} selection={null} />);
		expect(screen.queryByLabelText("Player name")).not.toBeInTheDocument();
	});

	it("shows a loading hint while the selected player's detail is loading", () => {
		mocks.detail.player = null;
		render(
			<PlayerPanel
				isPaused={false}
				onLeave={vi.fn()}
				selection={makeSelection()}
			/>
		);
		expect(screen.getByText("Loading...")).toBeInTheDocument();
	});

	it("renders the seat label and player name once selected", () => {
		render(
			<PlayerPanel
				isPaused={false}
				onLeave={vi.fn()}
				selection={makeSelection({ seatPosition: 2 })}
			/>
		);
		expect(screen.getByText("S3")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
	});

	it("passes the player's tags to the tag field", () => {
		render(
			<PlayerPanel
				isPaused={false}
				onLeave={vi.fn()}
				selection={makeSelection()}
			/>
		);
		expect(screen.getByTestId("tag-field")).toHaveTextContent("selected:Fish");
	});

	it("renders the seat dot colored from the selected player's first tag", () => {
		mocks.detail.player = {
			id: "p-1",
			memo: "<p>old</p>",
			name: "Alice",
			tags: [{ color: "red", id: "t1", name: "Reg" }],
		};
		const { container } = render(
			<PlayerPanel
				isPaused={false}
				onLeave={vi.fn()}
				selection={makeSelection()}
			/>
		);
		const dot = container.querySelector(".size-2.rounded-full");
		expect(dot).toHaveStyle({ backgroundColor: "var(--destructive)" });
	});

	it("saves an edited name when the input loses focus", async () => {
		const user = userEvent.setup();
		render(
			<PlayerPanel
				isPaused={false}
				onLeave={vi.fn()}
				selection={makeSelection()}
			/>
		);
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

	it("saves the memo when focus leaves the memo editor", async () => {
		const user = userEvent.setup();
		render(
			<PlayerPanel
				isPaused={false}
				onLeave={vi.fn()}
				selection={makeSelection()}
			/>
		);
		await user.click(screen.getByTestId("memo-editor"));
		await user.tab();
		expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
			id: "p-1",
			memo: "<p>edited</p>",
		});
	});

	it("calls onLeave exactly once with the selection when Leave is clicked", async () => {
		const user = userEvent.setup();
		const onLeave = vi.fn();
		const selection = makeSelection();
		render(
			<PlayerPanel isPaused={false} onLeave={onLeave} selection={selection} />
		);
		await user.click(screen.getByRole("button", { name: LEAVE_BUTTON_NAME }));
		expect(onLeave).toHaveBeenCalledTimes(1);
		expect(onLeave).toHaveBeenNthCalledWith(1, selection);
	});

	it("disables the Leave button while the session is paused", () => {
		render(
			<PlayerPanel
				isPaused={true}
				onLeave={vi.fn()}
				selection={makeSelection()}
			/>
		);
		expect(
			screen.getByRole("button", { name: LEAVE_BUTTON_NAME })
		).toBeDisabled();
	});

	it("keeps the Leave button enabled when the session is not paused", () => {
		render(
			<PlayerPanel
				isPaused={false}
				onLeave={vi.fn()}
				selection={makeSelection()}
			/>
		);
		expect(
			screen.getByRole("button", { name: LEAVE_BUTTON_NAME })
		).toBeEnabled();
	});
});
