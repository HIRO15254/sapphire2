import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	currencies: [] as Array<{
		balance: number;
		id: string;
		name: string;
		unit?: string | null;
	}>,
	getQueryData: vi.fn(),
	invalidateQueries: vi.fn(),
	setQueryData: vi.fn(),
	transactionsByCurrency: {} as Record<
		string,
		{
			items: Array<{
				amount: number;
				id: string;
				memo?: string | null;
				sessionId?: string | null;
				transactedAt: string;
				transactionTypeId?: string;
				transactionTypeName: string;
			}>;
			nextCursor?: string;
		}
	>,
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: {
		mutationFn: (arg: unknown) => Promise<unknown> | unknown;
		onSettled?: () => void;
		onSuccess?: () => void;
	}) => ({
		isPending: false,
		mutate: async (arg: unknown) => {
			await options.mutationFn(arg);
			await options.onSuccess?.();
			await options.onSettled?.();
		},
	}),
	useQuery: (options: { queryKey: unknown[] }) => {
		const [scope, id] = options.queryKey as [string, string?];
		if (scope === "currency-list") {
			return { data: mocks.currencies, isLoading: false };
		}
		if (scope === "currency-transaction-list") {
			return {
				data: id ? mocks.transactionsByCurrency[id] : undefined,
				isLoading: false,
			};
		}
		return { data: undefined, isLoading: false };
	},
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: mocks.getQueryData,
		invalidateQueries: mocks.invalidateQueries,
		setQueryData: mocks.setQueryData,
	}),
}));

vi.mock("@/currencies/components/currency-form", () => ({
	CurrencyForm: ({
		defaultValues,
		onCancel,
	}: {
		defaultValues?: { name: string; unit?: string };
		onCancel?: () => void;
	}) => (
		<div>
			<div>Currency Form</div>
			{defaultValues ? <pre>{JSON.stringify(defaultValues)}</pre> : null}
			<button onClick={onCancel} type="button">
				Cancel Currency
			</button>
		</div>
	),
}));

vi.mock("@/currencies/components/transaction-form", () => ({
	TransactionForm: ({
		defaultValues,
	}: {
		defaultValues?: {
			amount: number;
			memo?: string;
			transactedAt: string;
			transactionTypeId: string;
		};
	}) => (
		<div>
			<div>Transaction Form</div>
			{defaultValues ? <pre>{JSON.stringify(defaultValues)}</pre> : null}
		</div>
	),
}));

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		description,
		open,
		title,
	}: {
		children: ReactNode;
		description?: ReactNode;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{description ? <p>{description}</p> : null}
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
		currencyTransaction: {
			listByCurrency: {
				queryOptions: ({ currencyId }: { currencyId: string }) => ({
					queryKey: ["currency-transaction-list", currencyId],
				}),
			},
		},
	},
	trpcClient: {
		currency: {
			create: { mutate: vi.fn(async () => undefined) },
			delete: { mutate: vi.fn(async () => undefined) },
			update: { mutate: vi.fn(async () => undefined) },
		},
		currencyTransaction: {
			create: { mutate: vi.fn(async () => undefined) },
			delete: { mutate: vi.fn(async () => undefined) },
			listByCurrency: {
				query: vi.fn(async () => ({ items: [], nextCursor: undefined })),
			},
			update: { mutate: vi.fn(async () => undefined) },
		},
	},
}));

let routeModule: typeof import("@/routes/currencies/index");

describe("CurrenciesPage", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/currencies/index");
	}, 20_000);

	beforeEach(() => {
		mocks.currencies = [];
		mocks.transactionsByCurrency = {};
	});

	it("shows the empty state and opens or closes the new currency dialog", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(screen.getByText("No currencies yet")).toBeInTheDocument();

		await user.click(
			screen.getAllByRole("button", { name: "New Currency" })[0]
		);
		expect(
			screen.getByRole("heading", { name: "New Currency" })
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Cancel Currency" }));
		expect(
			screen.queryByRole("heading", { name: "New Currency" })
		).not.toBeInTheDocument();
	}, 15_000);

	it("expands and collapses a currency row and opens the add transaction dialog", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		mocks.currencies = [
			{ balance: 3200, id: "currency-1", name: "USD", unit: "$" },
		];
		mocks.transactionsByCurrency = {
			"currency-1": { items: [], nextCursor: undefined },
		};

		render(<Component />);

		await user.click(screen.getAllByText("USD")[0]);
		expect(screen.getByText("Transaction History")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Add" }));
		expect(
			screen.getByRole("heading", { name: "Add Transaction" })
		).toBeInTheDocument();

		await user.click(screen.getAllByText("USD")[0]);
		expect(screen.queryByText("Transaction History")).not.toBeInTheDocument();
	});

	it("opens the edit transaction dialog with the expected default values", async () => {
		const user = userEvent.setup();
		const Component = routeModule.Route.options.component as ComponentType;

		mocks.currencies = [
			{ balance: 3200, id: "currency-1", name: "USD", unit: "$" },
		];
		mocks.transactionsByCurrency = {
			"currency-1": {
				items: [
					{
						amount: 500,
						id: "tx-1",
						memo: "Desk float",
						transactedAt: "2026-03-20T10:00:00.000Z",
						transactionTypeId: "type-deposit",
						transactionTypeName: "Deposit",
					},
				],
				nextCursor: undefined,
			},
		};

		render(<Component />);

		await user.click(screen.getAllByText("USD")[0]);
		await user.click(screen.getByText("2026/03/20"));
		await user.click(screen.getByLabelText("Edit transaction"));

		expect(
			screen.getByRole("heading", { name: "Edit Transaction" })
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'{"amount":500,"transactionTypeId":"type-deposit","transactedAt":"2026-03-20T10:00:00.000Z","memo":"Desk float"}'
			)
		).toBeInTheDocument();
	});
});
