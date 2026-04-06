import { render, screen } from "@testing-library/react";
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

vi.mock("@/stores/components/store-card", () => ({
	StoreCard: ({ store }: { store: { name: string } }) => (
		<div>Store Row: {store.name}</div>
	),
}));

vi.mock("@/stores/components/store-form", () => ({
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
});
