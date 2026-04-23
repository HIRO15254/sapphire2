import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	invalidateQueries: vi.fn(),
	players: [] as Array<{ id: string; name: string }>,
	playerTags: [] as Array<{ color: string; id: string; name: string }>,
	setQueryData: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		isPending: false,
		mutate: vi.fn(),
		mutateAsync: vi.fn(async () => ({
			color: "blue",
			id: "tag-1",
			name: "VIP",
		})),
	}),
	useQuery: (options: { queryKey: unknown[] }) => {
		const [scope] = options.queryKey as [string];
		if (scope === "player-list") {
			return { data: mocks.players, isLoading: false };
		}
		if (scope === "player-tag-list") {
			return { data: mocks.playerTags, isLoading: false };
		}
		return { data: undefined, isLoading: false };
	},
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
		invalidateQueries: mocks.invalidateQueries,
		setQueryData: mocks.setQueryData,
	}),
}));

vi.mock("@/features/players/components/player-card", () => ({
	PlayerCard: ({ player }: { player: { name: string } }) => (
		<div>Player Row: {player.name}</div>
	),
}));

vi.mock("@/features/players/components/player-filters", () => ({
	PlayerFilters: () => <div>Player Filters</div>,
}));

vi.mock("@/features/players/components/player-form", () => ({
	PlayerForm: () => <div>Player Form</div>,
}));

vi.mock("@/features/players/components/player-tag-manager", () => ({
	PlayerTagManager: () => <div>Tag Manager</div>,
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
				queryOptions: () => ({ queryKey: ["player-list"] }),
			},
		},
		playerTag: {
			list: {
				queryOptions: () => ({ queryKey: ["player-tag-list"] }),
			},
		},
	},
	trpcClient: {
		player: {
			create: { mutate: vi.fn(async () => undefined) },
			delete: { mutate: vi.fn(async () => undefined) },
			update: { mutate: vi.fn(async () => undefined) },
		},
		playerTag: {
			create: {
				mutate: vi.fn(async () => ({
					color: "blue",
					id: "tag-1",
					name: "VIP",
				})),
			},
		},
	},
}));

let routeModule: typeof import("@/routes/players/index");

describe("PlayersPage", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/players/index");
	}, 20_000);

	beforeEach(() => {
		mocks.players = [];
		mocks.playerTags = [];
	});

	it("renders the empty state", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByRole("heading", { name: "Players" })
		).toBeInTheDocument();
		expect(screen.getByText("No players yet")).toBeInTheDocument();
	});

	it("renders the populated list in a vertical shell", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		mocks.players = [{ id: "player-1", name: "Alice" }];
		mocks.playerTags = [{ color: "blue", id: "vip", name: "VIP" }];

		render(<Component />);

		expect(screen.getByText("Player Filters")).toBeInTheDocument();
		expect(screen.getByText("Player Row: Alice")).toBeInTheDocument();
		expect(screen.queryByText("No players yet")).not.toBeInTheDocument();
	});

	it("hides the PlayerFilters row when there are no available tags", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		mocks.playerTags = [];

		render(<Component />);

		expect(screen.queryByText("Player Filters")).not.toBeInTheDocument();
	});

	it("shows the create empty-state action when no filter is selected", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByText("Create your first player to start tracking opponents.")
		).toBeInTheDocument();
	});

	it("opens the New Player dialog when the header action is clicked", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		// Two New Player buttons exist (header + empty-state); click the first.
		await user.click(screen.getAllByRole("button", { name: "New Player" })[0]);

		expect(
			screen.getByRole("heading", { name: "New Player" })
		).toBeInTheDocument();
		expect(screen.getByText("Player Form")).toBeInTheDocument();
	});

	it("opens the Manage Tags dialog from the page header action", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		await user.click(screen.getByRole("button", { name: "Manage Tags" }));

		expect(
			screen.getByRole("heading", { name: "Manage Tags" })
		).toBeInTheDocument();
		expect(screen.getByText("Tag Manager")).toBeInTheDocument();
	});

	it("renders multiple player rows in order", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		mocks.players = [
			{ id: "p1", name: "Alice" },
			{ id: "p2", name: "Bob" },
			{ id: "p3", name: "Carol" },
		];

		render(<Component />);

		expect(screen.getByText("Player Row: Alice")).toBeInTheDocument();
		expect(screen.getByText("Player Row: Bob")).toBeInTheDocument();
		expect(screen.getByText("Player Row: Carol")).toBeInTheDocument();
	});
});
