import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TransactionTypeManager } from "./transaction-type-manager";

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
});

const mocks = vi.hoisted(() => ({
	deleteMutate: vi.fn(async () => undefined),
	invalidateQueries: vi.fn(),
	types: [{ id: "type-1", name: "Cash" }],
	updateMutate: vi.fn(async () => undefined),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: {
		mutationFn: (arg: unknown) => Promise<unknown> | unknown;
		onSettled?: () => void;
		onSuccess?: () => void;
	}) => {
		const mutate = async (arg: unknown) => {
			const result = await options.mutationFn(arg);
			await options.onSuccess?.();
			await options.onSettled?.();
			return result;
		};
		return {
			isPending: false,
			mutate,
			mutateAsync: mutate,
		};
	},
	useQuery: () => ({ data: mocks.types }),
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
		invalidateQueries: mocks.invalidateQueries,
		setQueryData: vi.fn(),
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		transactionType: {
			list: {
				queryOptions: () => ({ queryKey: ["transaction-types"] }),
			},
		},
	},
	trpcClient: {
		transactionType: {
			delete: { mutate: mocks.deleteMutate },
			update: { mutate: mocks.updateMutate },
		},
	},
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
			<div data-testid={`dialog-${title}`}>
				<h2>{title}</h2>
				{children}
			</div>
		) : null,
}));

describe("TransactionTypeManager", () => {
	it("edits and saves a transaction type", async () => {
		const user = userEvent.setup();

		render(<TransactionTypeManager />);

		await user.click(screen.getByLabelText("Edit type Cash"));

		const input = screen.getByRole("textbox");
		await user.clear(input);
		await user.type(input, "Tournament Buy-in");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith({
				id: "type-1",
				name: "Tournament Buy-in",
			});
		});
	});

	it("confirms and deletes a transaction type", async () => {
		const user = userEvent.setup();

		render(<TransactionTypeManager />);

		await user.click(screen.getByLabelText("Delete type Cash"));
		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mocks.deleteMutate).toHaveBeenCalledWith({ id: "type-1" });
		});
	});

	it("shows an error when delete fails", async () => {
		const user = userEvent.setup();
		mocks.deleteMutate.mockRejectedValueOnce(
			new Error("Cannot delete: type is in use by transactions")
		);

		render(<TransactionTypeManager />);

		await user.click(screen.getByLabelText("Delete type Cash"));
		await user.click(screen.getByRole("button", { name: "Delete" }));

		expect(
			await screen.findByText("Cannot delete: type is in use by transactions")
		).toBeInTheDocument();
	});

	it("renders the empty state when no types exist", () => {
		mocks.types.length = 0;
		try {
			render(<TransactionTypeManager />);
			expect(screen.getByText("No transaction types yet")).toBeInTheDocument();
		} finally {
			mocks.types.push({ id: "type-1", name: "Cash" });
		}
	});
});
