import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionTypeManager } from "../transaction-type-manager";

const mocks = vi.hoisted(() => ({
	deleteMutate: vi.fn(async () => undefined),
	invalidateQueries: vi.fn(),
	setQueryData: vi.fn(),
	types: [{ id: "type-1", name: "Cash" }],
	updateMutate: vi.fn(async () => undefined),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: {
		mutationFn: (arg: unknown) => Promise<unknown> | unknown;
		onError?: (error: unknown, arg: unknown, context?: unknown) => void;
		onMutate?: (arg: unknown) => Promise<unknown> | unknown;
		onSettled?: (
			data: unknown,
			error: unknown,
			arg: unknown,
			context?: unknown
		) => void;
		onSuccess?: (data: unknown, arg: unknown, context?: unknown) => void;
	}) => ({
		isPending: false,
		mutate: async (arg: unknown) => {
			let context: unknown;
			try {
				context = await options.onMutate?.(arg);
				const result = await options.mutationFn(arg);
				await options.onSuccess?.(result, arg, context);
				await options.onSettled?.(result, null, arg, context);
			} catch (error) {
				await options.onError?.(error, arg, context);
				await options.onSettled?.(undefined, error, arg, context);
			}
		},
	}),
	useQuery: () => ({ data: mocks.types }),
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(() => mocks.types),
		invalidateQueries: mocks.invalidateQueries,
		setQueryData: mocks.setQueryData,
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

describe("TransactionTypeManager", () => {
	it("edits and saves a transaction type", async () => {
		const user = userEvent.setup();

		render(<TransactionTypeManager />);

		await user.click(screen.getByLabelText("Edit type"));
		await user.clear(screen.getByRole("textbox"));
		await user.type(screen.getByRole("textbox"), "Tournament Buy-in");
		await user.click(screen.getByLabelText("Save type"));

		await waitFor(() => {
			expect(mocks.updateMutate).toHaveBeenCalledWith({
				id: "type-1",
				name: "Tournament Buy-in",
			});
		});
	});

	it("shows an alert when delete fails", async () => {
		const user = userEvent.setup();
		mocks.deleteMutate.mockRejectedValueOnce(new Error("Type is in use"));

		render(<TransactionTypeManager />);

		await user.click(screen.getByLabelText("Delete type"));
		await user.click(screen.getByLabelText("Confirm delete type"));

		expect(await screen.findByText("Type is in use")).toBeInTheDocument();
	});
});
