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

// Passthrough the popover/command chrome so the dropdown items are directly
// assertable and clickable (the cmdk/Radix internals are not under test here).
vi.mock("@/shared/components/ui/popover", () => ({
	Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	PopoverAnchor: ({ children }: { children: ReactNode }) => <>{children}</>,
	PopoverContent: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
}));

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
		onAddExisting: vi.fn(),
		onAddNew: vi.fn(),
		onAddTemporary: vi.fn(),
		...overrides,
	};
	render(<EmptySeatEditor {...props} />);
	return props;
}

describe("EmptySeatEditor", () => {
	beforeEach(() => {
		mocks.state.canCreate = false;
		mocks.state.matches = [];
		mocks.state.open = true;
		mocks.state.query = "";
		mocks.state.trimmed = "";
		mocks.state.onCreate.mockReset();
		mocks.state.onSelectExisting.mockReset();
		mocks.state.onTemporary.mockReset();
		mocks.state.setOpen.mockReset();
		mocks.state.setQuery.mockReset();
	});

	it("shows the search field inline without any expansion", () => {
		setup();
		expect(screen.getByRole("combobox")).toBeInTheDocument();
	});

	it("typing forwards to setQuery and opens the dropdown", async () => {
		const user = userEvent.setup();
		setup();
		await user.type(screen.getByRole("combobox"), "N");
		expect(mocks.state.setQuery).toHaveBeenCalledWith("N");
		expect(mocks.state.setOpen).toHaveBeenCalledWith(true);
	});

	it("always offers a temporary-player option in the dropdown", async () => {
		const user = userEvent.setup();
		setup();
		await user.click(
			screen.getByRole("button", { name: "Add temporary player" })
		);
		expect(mocks.state.onTemporary).toHaveBeenCalledTimes(1);
	});

	it("hides the create option when there is nothing to create", () => {
		mocks.state.canCreate = false;
		setup();
		expect(screen.queryByText(REGEX_CREATE)).not.toBeInTheDocument();
	});

	it("offers a create option built from the trimmed query", async () => {
		const user = userEvent.setup();
		mocks.state.canCreate = true;
		mocks.state.trimmed = "Nina";
		setup();
		await user.click(screen.getByRole("button", { name: 'Create "Nina"' }));
		expect(mocks.state.onCreate).toHaveBeenCalledTimes(1);
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

	it("renders no dropdown when closed", () => {
		mocks.state.open = false;
		setup();
		expect(
			screen.queryByRole("button", { name: "Add temporary player" })
		).not.toBeInTheDocument();
	});
});
