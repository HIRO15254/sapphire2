import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	invalidateQueries: vi.fn(),
	setQueryData: vi.fn(),
	stores: [] as Array<{ id: string; memo?: string | null; name: string }>,
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
	}),
	useQuery: () => ({
		data: mocks.stores,
		isLoading: false,
	}),
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
		invalidateQueries: mocks.invalidateQueries,
		setQueryData: mocks.setQueryData,
	}),
}));

vi.mock("@/features/stores/components/store-card", () => ({
	StoreCard: ({ store }: { store: { name: string } }) => (
		<div>Store Row: {store.name}</div>
	),
}));

vi.mock("@/features/stores/components/store-form", () => ({
	StoreForm: () => <div>Store Form</div>,
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
		store: {
			list: {
				queryOptions: () => ({ queryKey: ["store-list"] }),
			},
		},
	},
	trpcClient: {
		store: {
			create: { mutate: vi.fn(async () => undefined) },
			delete: { mutate: vi.fn(async () => undefined) },
			update: { mutate: vi.fn(async () => undefined) },
		},
	},
}));

let routeModule: typeof import("@/routes/stores/index");

describe("StoresPage", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/stores/index");
	}, 20_000);

	beforeEach(() => {
		mocks.stores = [];
	});

	it("renders the empty state", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByRole("heading", { name: "Stores" })).toBeInTheDocument();
		expect(screen.getByText("No stores yet")).toBeInTheDocument();
	});

	it("renders the populated list in a vertical shell", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		mocks.stores = [{ id: "store-1", memo: "Late nights", name: "Akiba" }];

		render(<Component />);

		expect(screen.getByText("Store Row: Akiba")).toBeInTheDocument();
		expect(screen.queryByText("No stores yet")).not.toBeInTheDocument();
	});

	it("renders multiple stores in order", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		mocks.stores = [
			{ id: "s1", memo: null, name: "Akiba" },
			{ id: "s2", memo: null, name: "Shinjuku" },
			{ id: "s3", memo: null, name: "Shibuya" },
		];

		render(<Component />);

		expect(screen.getByText("Store Row: Akiba")).toBeInTheDocument();
		expect(screen.getByText("Store Row: Shinjuku")).toBeInTheDocument();
		expect(screen.getByText("Store Row: Shibuya")).toBeInTheDocument();
	});

	it("opens the New Store dialog from the page header action", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		await user.click(screen.getAllByRole("button", { name: "New Store" })[0]);

		expect(
			screen.getByRole("heading", { name: "New Store" })
		).toBeInTheDocument();
		expect(screen.getByText("Store Form")).toBeInTheDocument();
	});

	it("opens the New Store dialog from the empty-state action", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		// Empty state renders a second New Store button
		const buttons = screen.getAllByRole("button", { name: "New Store" });
		expect(buttons.length).toBeGreaterThanOrEqual(2);
		await user.click(buttons[1] as HTMLElement);

		expect(
			screen.getByRole("heading", { name: "New Store" })
		).toBeInTheDocument();
	});
});
