import { render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	currencies: [] as Array<{ id: string; name: string }>,
	invalidateQueries: vi.fn(),
	sessionTags: [] as Array<{ id: string; name: string }>,
	sessions: [] as Array<{ id: string; type: string }>,
	setQueryData: vi.fn(),
	stores: [] as Array<{ id: string; name: string }>,
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
	useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		isPending: false,
		mutate: vi.fn(),
		mutateAsync: vi.fn(async () => ({ id: "tag-1", name: "Live" })),
	}),
	useQuery: (options: { queryKey: unknown[] }) => {
		const [scope] = options.queryKey as [string];
		if (scope === "session-list") {
			return { data: { items: mocks.sessions }, isLoading: false };
		}
		if (scope === "session-tag-list") {
			return { data: mocks.sessionTags, isLoading: false };
		}
		if (scope === "store-list") {
			return { data: mocks.stores, isLoading: false };
		}
		if (scope === "currency-list") {
			return { data: mocks.currencies, isLoading: false };
		}
		if (scope === "ring-game-list" || scope === "tournament-list") {
			return { data: [], isLoading: false };
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

vi.mock("@/sessions/components/session-card", () => ({
	SessionCard: ({ session }: { session: { id: string } }) => (
		<div>Session Row: {session.id}</div>
	),
}));

vi.mock("@/sessions/components/session-filters", () => ({
	SessionFilters: () => <div>Session Filters</div>,
}));

vi.mock("@/sessions/components/session-form", () => ({
	SessionForm: () => <div>Session Form</div>,
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
		currency: {
			list: {
				queryOptions: () => ({ queryKey: ["currency-list"] }),
			},
		},
		ringGame: {
			listByStore: {
				queryOptions: () => ({ queryKey: ["ring-game-list"] }),
			},
		},
		session: {
			list: {
				queryOptions: () => ({ queryKey: ["session-list"] }),
			},
		},
		sessionTag: {
			list: {
				queryOptions: () => ({ queryKey: ["session-tag-list"] }),
			},
		},
		store: {
			list: {
				queryOptions: () => ({ queryKey: ["store-list"] }),
			},
		},
		tournament: {
			listByStore: {
				queryOptions: () => ({ queryKey: ["tournament-list"] }),
			},
		},
	},
	trpcClient: {
		liveCashGameSession: {
			reopen: { mutate: vi.fn(async () => undefined) },
		},
		session: {
			create: { mutate: vi.fn(async () => undefined) },
			delete: { mutate: vi.fn(async () => undefined) },
			update: { mutate: vi.fn(async () => undefined) },
		},
		sessionTag: {
			create: { mutate: vi.fn(async () => ({ id: "tag-1", name: "Live" })) },
		},
	},
}));

let routeModule: typeof import("@/routes/sessions/index");

describe("SessionsPage", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/sessions/index");
	}, 20_000);

	beforeEach(() => {
		mocks.currencies = [];
		mocks.sessionTags = [];
		mocks.sessions = [];
		mocks.stores = [];
	});

	it("renders the empty state", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByRole("heading", { name: "Sessions" })
		).toBeInTheDocument();
		expect(screen.getByText("No sessions yet")).toBeInTheDocument();
		expect(screen.getByText("Session Filters")).toBeInTheDocument();
	});

	it("renders BB/BI toggle switch", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByLabelText("BB/BI")).toBeInTheDocument();
	});

	it("renders BB/BI toggle off by default", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		const toggle = screen.getByRole("switch");
		expect(toggle).not.toBeChecked();
	});

	it("renders the populated vertical list", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		mocks.sessions = [{ id: "session-1", type: "cash_game" }];

		render(<Component />);

		expect(screen.getByText("Session Row: session-1")).toBeInTheDocument();
		expect(screen.queryByText("No sessions yet")).not.toBeInTheDocument();
	});
});
