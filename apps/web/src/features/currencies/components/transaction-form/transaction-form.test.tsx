import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionForm } from "./transaction-form";

const mocks = vi.hoisted(() => ({
	createTypeMutate: vi.fn(async ({ name }: { name: string }) => ({
		id: `created-${name.toLowerCase()}`,
		name,
	})),
	invalidateQueries: vi.fn(),
	transactionTypes: [
		{ id: "type-deposit", name: "Deposit" },
		{ id: "type-withdrawal", name: "Withdrawal" },
	],
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: {
		mutationFn: (arg: unknown) => Promise<unknown> | unknown;
	}) => ({
		isPending: false,
		mutateAsync: (arg: unknown) => Promise.resolve(options.mutationFn(arg)),
	}),
	useQuery: () => ({
		data: mocks.transactionTypes,
		isLoading: false,
	}),
	useQueryClient: () => ({
		invalidateQueries: mocks.invalidateQueries,
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		transactionType: {
			list: {
				queryOptions: () => ({ queryKey: ["transactionType"] }),
			},
		},
	},
	trpcClient: {
		transactionType: {
			create: {
				mutate: mocks.createTypeMutate,
			},
		},
	},
}));

describe("TransactionForm", () => {
	it("submits edit values without changing the payload shape", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<TransactionForm
				defaultValues={{
					amount: 1200,
					memo: "Original memo",
					transactedAt: "2026-03-22T10:00:00.000Z",
					transactionTypeId: "type-deposit",
				}}
				onSubmit={onSubmit}
			/>
		);

		fireEvent.change(screen.getByLabelText("Amount *"), {
			target: { value: "1500" },
		});
		fireEvent.change(screen.getByLabelText("Date *"), {
			target: { value: "2026-03-25" },
		});
		fireEvent.change(screen.getByLabelText("Memo"), {
			target: { value: "Updated memo" },
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith({
			amount: 1500,
			memo: "Updated memo",
			transactedAt: "2026-03-25",
			transactionTypeId: "type-deposit",
		});
	});

	it("creates a new type and submits the created id", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<TransactionForm onSubmit={onSubmit} />);

		fireEvent.change(screen.getByLabelText("Amount *"), {
			target: { value: "500" },
		});
		fireEvent.change(screen.getByLabelText("Date *"), {
			target: { value: "2026-04-05" },
		});

		await user.type(screen.getByRole("combobox"), "Manual");
		await user.click(screen.getByRole("option", { name: 'Create "Manual"' }));
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(mocks.createTypeMutate).toHaveBeenCalledWith({ name: "Manual" });
		expect(onSubmit).toHaveBeenCalledWith({
			amount: 500,
			memo: undefined,
			transactedAt: "2026-04-05",
			transactionTypeId: "created-manual",
		});
	}, 15_000);

	it("does not submit when required fields are empty", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<TransactionForm onSubmit={onSubmit} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("shows Saving... and disables submit while isLoading", () => {
		render(<TransactionForm isLoading onSubmit={vi.fn()} />);
		const button = screen.getByRole("button", { name: "Saving..." });
		expect(button).toBeInTheDocument();
		expect(button).toBeDisabled();
	});
});
