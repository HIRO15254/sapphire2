import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/__tests__/test-utils";
import { TournamentForm } from "./tournament-form";

// VariantSelect (rendered by the Variant field) uses real react-query hooks
// against trpc.gameVariant.list, so this file keeps the real
// @tanstack/react-query implementation and wraps renders in a
// QueryClientProvider (see renderForm below) instead of mocking the module.
vi.mock("@/utils/trpc", () => ({
	trpc: {
		currency: {
			list: {
				queryOptions: () => ({
					queryKey: ["currency", "list"],
					queryFn: async () => [
						{ id: "currency-1", name: "JPY", unit: "JPY" },
						{ id: "currency-2", name: "USD", unit: "$" },
					],
				}),
			},
		},
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameVariant", "list"],
					queryFn: async () => [],
				}),
			},
		},
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameGroup", "list"],
					queryFn: async () => [],
				}),
			},
		},
		gameMix: {
			list: {
				queryOptions: () => ({
					queryKey: ["gameMix", "list"],
					queryFn: async () => [],
				}),
			},
		},
	},
	trpcClient: {
		gameVariant: {
			create: {
				mutate: vi.fn(),
			},
		},
	},
}));

const FORM_ID = "tournament-form-test";

// The form renders no submit button of its own — the surrounding FormSheet
// owns Save and submits via the `form` attribute. Mirror that with an
// external button so the tests exercise the `id={formId}` wiring.
function renderForm(
	props: Partial<React.ComponentProps<typeof TournamentForm>>
) {
	const onSubmit = props.onSubmit ?? vi.fn();
	const result = renderWithQueryClient(
		<>
			<TournamentForm formId={FORM_ID} onSubmit={onSubmit} {...props} />
			<button form={FORM_ID} type="submit">
				submit-trigger
			</button>
		</>
	);
	return { onSubmit, ...result };
}

describe("TournamentForm", () => {
	it("renders memo as textarea and preserves edit payload", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({
			defaultValues: {
				name: "Sunday Major",
				variant: "nlh",
				buyIn: 10_000,
				entryFee: 1000,
				memo: "two flights\nfinal table on Sunday",
				tags: ["series"],
				chipPurchases: [{ name: "Addon", cost: 2000, chips: 10_000 }],
			},
		});

		const memo = screen.getByLabelText("Memo");
		expect(memo.tagName).toBe("TEXTAREA");
		expect(memo).toHaveValue("two flights\nfinal table on Sunday");

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Sunday Major",
				buyIn: 10_000,
				entryFee: 1000,
				memo: "two flights\nfinal table on Sunday",
				tags: ["series"],
				chipPurchases: [{ name: "Addon", cost: 2000, chips: 10_000 }],
			})
		);
	});

	it("submits multiline memo in create mode", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		fireEvent.change(screen.getByLabelText("Tournament name *"), {
			target: { value: "Nightly Deepstack" },
		});
		fireEvent.change(screen.getByLabelText("Memo"), {
			target: { value: "late reg open\n15 minute levels" },
		});

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Nightly Deepstack",
				memo: "late reg open\n15 minute levels",
				chipPurchases: [],
				tags: [],
			})
		);
	});

	it("blocks submit when the required tournament name is empty", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("clears optional table size and currency selections", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({
			defaultValues: {
				name: "Sunday Major",
				variant: "NL Hold'em",
				tableSize: 9,
				currencyId: "currency-1",
			},
		});
		const clearButtons = await screen.findAllByRole("button", {
			name: "Clear selection",
		});
		expect(clearButtons).toHaveLength(2);

		await user.click(clearButtons[0]);
		await user.click(screen.getByRole("button", { name: "Clear selection" }));
		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				tableSize: undefined,
				currencyId: undefined,
			})
		);
	});

	it("submits tags added through the combobox", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		fireEvent.change(screen.getByLabelText("Tournament name *"), {
			target: { value: "Nightly Deepstack" },
		});
		await user.type(screen.getByLabelText("Search tags"), "Series");
		await user.keyboard("{Enter}");

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Nightly Deepstack",
				tags: ["Series"],
			})
		);
	});

	it("renders no submit button of its own and tags the form with the id", () => {
		const { container } = renderForm({});
		expect(container.querySelector("form")).toHaveAttribute("id", FORM_ID);
		expect(
			screen.queryByRole("button", { name: "Save" })
		).not.toBeInTheDocument();
	});
});
