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

describe("RingGameForm", () => {
	it("renders memo as textarea and preserves default values on submit", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<RingGameForm
				defaultValues={{
					name: "1/2 NLH",
					variant: "nlh",
					blind1: 1,
					blind2: 2,
					memo: "deep stack\nweekday game",
				}}
				onSubmit={onSubmit}
			/>
		);

		const memo = screen.getByLabelText("Memo");
		expect(memo.tagName).toBe("TEXTAREA");
		expect(memo).toHaveValue("deep stack\nweekday game");

		await user.click(screen.getByRole("button", { name: "Save" }));

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
		const onSubmit = vi.fn();

		render(<RingGameForm onSubmit={onSubmit} />);

		fireEvent.change(screen.getByLabelText("Game Name *"), {
			target: { value: "5/10 NLH" },
		});
		fireEvent.change(screen.getByLabelText("Memo"), {
			target: { value: "straddles allowed\nweekend only" },
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "5/10 NLH",
				memo: "straddles allowed\nweekend only",
			})
		);
	});

	it("blocks submit when the required Game Name is empty (Zod validation)", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<RingGameForm onSubmit={onSubmit} />);
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});
});
