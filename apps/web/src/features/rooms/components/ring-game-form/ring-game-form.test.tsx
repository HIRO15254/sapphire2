import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RingGameForm } from "./ring-game-form";

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		data: [
			{ id: "currency-1", name: "JPY", unit: "JPY" },
			{ id: "currency-2", name: "USD", unit: "$" },
		],
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		currency: {
			list: {
				queryOptions: () => ({}),
			},
		},
	},
}));

const FORM_ID = "ring-game-form-test";

// The form renders no submit button of its own — the surrounding FormSheet
// owns Save and submits via the `form` attribute. Mirror that with an
// external button so the tests exercise the `id={formId}` wiring.
function renderForm(props: Partial<React.ComponentProps<typeof RingGameForm>>) {
	const onSubmit = props.onSubmit ?? vi.fn();
	const result = render(
		<>
			<RingGameForm formId={FORM_ID} onSubmit={onSubmit} {...props} />
			<button form={FORM_ID} type="submit">
				submit-trigger
			</button>
		</>
	);
	return { onSubmit, ...result };
}

describe("RingGameForm", () => {
	it("renders memo as textarea and preserves default values on submit", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({
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
		const { onSubmit } = renderForm({});

		fireEvent.change(screen.getByLabelText("Game Name *"), {
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

	it("blocks submit when the required Game Name is empty (Zod validation)", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("renders no submit button of its own and tags the form with the id", () => {
		const { container } = renderForm({});
		expect(container.querySelector("form")).toHaveAttribute("id", FORM_ID);
		expect(
			screen.queryByRole("button", { name: "Save" })
		).not.toBeInTheDocument();
	});
});
