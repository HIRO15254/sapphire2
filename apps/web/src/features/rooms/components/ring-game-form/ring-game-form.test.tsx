import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/__tests__/test-utils";
import { RingGameForm } from "./ring-game-form";

// VariantSelect (rendered by the Variant field) and the blind labels both use
// real react-query hooks against trpc.gameVariant.list, so this file keeps
// the real @tanstack/react-query implementation and wraps renders in a
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

const FORM_ID = "ring-game-form-test";

// The form renders no submit button of its own — the surrounding FormSheet
// owns Save and submits via the `form` attribute. Mirror that with an
// external button so the tests exercise the `id={formId}` wiring. The form
// body mounts only after the game-master lists load (c05), so callers await
// a stable field before interacting.
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

	it("renders no submit button of its own and tags the form with the id", async () => {
		const { container } = await renderForm({});
		expect(container.querySelector("form")).toHaveAttribute("id", FORM_ID);
		expect(
			screen.queryByRole("button", { name: "Save" })
		).not.toBeInTheDocument();
	});
});
