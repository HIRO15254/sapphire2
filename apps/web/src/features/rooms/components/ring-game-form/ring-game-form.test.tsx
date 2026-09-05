import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/__tests__/test-utils";
import { RingGameForm } from "./ring-game-form";

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

const FORM_ID = "ring-game-form-test";

async function renderForm(
	props: Partial<React.ComponentProps<typeof RingGameForm>>
) {
	const onSubmit = props.onSubmit ?? vi.fn();
	const result = renderWithQueryClient(
		<>
			<RingGameForm formId={FORM_ID} onSubmit={onSubmit} {...props} />
			<button form={FORM_ID} type="submit">
				submit-trigger
			</button>
		</>
	);
	await screen.findByLabelText("Memo");
	return { onSubmit, ...result };
}

describe("RingGameForm", () => {
	it("shows a loading state until the game masters load, then mounts the form", async () => {
		renderWithQueryClient(<RingGameForm formId={FORM_ID} onSubmit={vi.fn()} />);
		expect(screen.getByText("Loading game data")).toBeInTheDocument();
		expect(screen.queryByLabelText("Memo")).not.toBeInTheDocument();
		await screen.findByLabelText("Memo");
		expect(screen.queryByText("Loading game data")).not.toBeInTheDocument();
	});

	it("renders memo as textarea and preserves default values on submit", async () => {
		const user = userEvent.setup();
		const { onSubmit } = await renderForm({
			defaultValues: {
				name: "1/2 NLH",
				variant: "nlh",
				blind1: 1,
				blind2: 2,
				memo: "deep stack\nweekday game",
			},
		});

		const memo = screen.getByLabelText("Memo");
		expect(memo.tagName).toBe("TEXTAREA");
		expect(memo).toHaveValue("deep stack\nweekday game");

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "1/2 NLH",
				blind1: 1,
				blind2: 2,
				memo: "deep stack\nweekday game",
			})
		);
	});

	it("submits multiline memo in create mode", async () => {
		const user = userEvent.setup();
		const { onSubmit } = await renderForm({});

		fireEvent.change(screen.getByLabelText("Game name *"), {
			target: { value: "5/10 NLH" },
		});
		fireEvent.change(screen.getByLabelText("Memo"), {
			target: { value: "straddles allowed\nweekend only" },
		});

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "5/10 NLH",
				memo: "straddles allowed\nweekend only",
			})
		);
	});

	it("blocks submit when the required game name is empty (Zod validation)", async () => {
		const user = userEvent.setup();
		const { onSubmit } = await renderForm({});

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("clears optional table size and currency selections", async () => {
		const user = userEvent.setup();
		const { onSubmit } = await renderForm({
			defaultValues: {
				name: "1/2 NLH",
				variant: "NL Hold'em",
				tableSize: 9,
				currencyId: "currency-1",
			},
		});
		const clearButtons = screen.getAllByRole("button", {
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

	it("renders no submit button of its own and tags the form with the id", async () => {
		const { container } = await renderForm({});
		expect(container.querySelector("form")).toHaveAttribute("id", FORM_ID);
		expect(
			screen.queryByRole("button", { name: "Save" })
		).not.toBeInTheDocument();
	});
});
