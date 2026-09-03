import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface PlayerOption {
	id: string;
	memo: string | null;
	name: string;
	tags: { color: string; id: string; name: string }[];
}

const mocks = vi.hoisted(() => ({
	state: {
		anchorRef: { current: null },
		canCreate: false,
		contentWidth: undefined as number | undefined,
		matches: [] as PlayerOption[],
		onCreate: vi.fn(),
		onHero: vi.fn(),
		onSelectExisting: vi.fn(),
		onTemporary: vi.fn(),
		open: true,
		query: "",
		setOpen: vi.fn(),
		setQuery: vi.fn(),
		trimmed: "",
	},
}));

vi.mock("./use-empty-seat-editor", () => ({
	useEmptySeatEditor: () => mocks.state,
}));

vi.mock("@/shared/components/ui/popover", () => ({
	Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	PopoverAnchor: ({ children }: { children: ReactNode }) => <>{children}</>,
	PopoverContent: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock(
	"@/features/live-sessions/components/active-session-scene/seat-list/player-tag-badges",
	() => ({
		PlayerTagBadges: ({ tags }: { tags: { id: string; name: string }[] }) => (
			<span>
				{tags.map((t) => (
					<span key={t.id}>{t.name}</span>
				))}
			</span>
		),
	})
);

vi.mock("@/shared/components/ui/command", () => ({
	Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CommandList: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
	CommandEmpty: ({ children }: { children: ReactNode }) => <li>{children}</li>,
	CommandItem: ({
		children,
		onSelect,
	}: {
		children: ReactNode;
		onSelect?: () => void;
	}) => (
		<li>
			<button onClick={onSelect} type="button">
				{children}
			</button>
		</li>
	),
}));

import { EmptySeatEditor } from "@/features/live-sessions/components/active-session-scene/seat-list/empty-seat-editor";

const REGEX_CREATE = /^Create /;
const REGEX_NINA = /Nina/;

function setup(
	overrides: Partial<React.ComponentProps<typeof EmptySeatEditor>> = {}
) {
	const props: React.ComponentProps<typeof EmptySeatEditor> = {
		excludePlayerIds: [],
		heroAvailable: true,
		onAddExisting: vi.fn(),
		onAddNew: vi.fn(),
		onAddTemporary: vi.fn(),
		onSeatHero: vi.fn(),
		...overrides,
	};
	return render(<EmptySeatEditor {...props} />);
}

describe("EmptySeatEditor", () => {
	beforeEach(() => {
		mocks.state.canCreate = false;
		mocks.state.matches = [];
		mocks.state.open = true;
		mocks.state.query = "";
		mocks.state.trimmed = "";
		mocks.state.onCreate.mockReset();
		mocks.state.onHero.mockReset();
		mocks.state.onSelectExisting.mockReset();
		mocks.state.onTemporary.mockReset();
		mocks.state.setOpen.mockReset();
		mocks.state.setQuery.mockReset();
	});

	it("typing forwards to setQuery and opens the dropdown", async () => {
		const user = userEvent.setup();
		setup();
		await user.type(screen.getByRole("combobox"), "N");
		expect(mocks.state.setQuery).toHaveBeenCalledWith("N");
		expect(mocks.state.setOpen).toHaveBeenCalledWith(true);
	});

	it("seats a temporary player from the Temp icon beside the field", async () => {
		const user = userEvent.setup();
		setup();
		await user.click(
			screen.getByRole("button", { name: "Seat temporary player" })
		);
		expect(mocks.state.onTemporary).toHaveBeenCalledTimes(1);
	});

	it("offers the Hero icon wired to onHero only while a hero seat is available", async () => {
		const user = userEvent.setup();
		const props = {
			excludePlayerIds: [],
			onAddExisting: vi.fn(),
			onAddNew: vi.fn(),
			onAddTemporary: vi.fn(),
			onSeatHero: vi.fn(),
		};
		const { rerender } = render(<EmptySeatEditor {...props} heroAvailable />);
		await user.click(screen.getByRole("button", { name: "Seat hero here" }));
		expect(mocks.state.onHero).toHaveBeenCalledTimes(1);

		rerender(<EmptySeatEditor {...props} heroAvailable={false} />);
		expect(
			screen.queryByRole("button", { name: "Seat hero here" })
		).not.toBeInTheDocument();
	});

	it("offers a create option built from the trimmed query only when canCreate", async () => {
		const user = userEvent.setup();
		mocks.state.canCreate = true;
		mocks.state.trimmed = "Nina";
		const { rerender } = setup();
		await user.click(screen.getByRole("button", { name: 'Create "Nina"' }));
		expect(mocks.state.onCreate).toHaveBeenCalledTimes(1);

		mocks.state.canCreate = false;
		rerender(
			<EmptySeatEditor
				excludePlayerIds={[]}
				heroAvailable
				onAddExisting={vi.fn()}
				onAddNew={vi.fn()}
				onAddTemporary={vi.fn()}
				onSeatHero={vi.fn()}
			/>
		);
		expect(screen.queryByText(REGEX_CREATE)).not.toBeInTheDocument();
	});

	it("lists matching players with their tags and seats one on select", async () => {
		const user = userEvent.setup();
		const nina = {
			id: "p-9",
			memo: null,
			name: "Nina",
			tags: [{ color: "#f00", id: "t1", name: "Whale" }],
		};
		mocks.state.matches = [nina];
		setup();
		expect(screen.getByText("Whale")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: REGEX_NINA }));
		expect(mocks.state.onSelectExisting).toHaveBeenCalledWith(nina);
	});

	it("shows an empty hint when there are no matches", () => {
		mocks.state.matches = [];
		setup();
		expect(screen.getByText("No matching players")).toBeInTheDocument();
	});

	it("renders no dropdown content when closed", () => {
		mocks.state.open = false;
		mocks.state.matches = [];
		setup();
		expect(screen.queryByText("No matching players")).not.toBeInTheDocument();
	});
});
