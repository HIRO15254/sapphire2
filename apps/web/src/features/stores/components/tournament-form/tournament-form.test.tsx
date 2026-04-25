import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentForm } from "./tournament-form";

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

describe("TournamentForm", () => {
	it("renders memo as textarea and preserves edit payload", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<TournamentForm
				defaultValues={{
					name: "Sunday Major",
					variant: "nlh",
					buyIn: 10_000,
					entryFee: 1000,
					memo: "two flights\nfinal table on Sunday",
					tags: ["series"],
					chipPurchases: [{ name: "Addon", cost: 2000, chips: 10_000 }],
				}}
				onSubmit={onSubmit}
			/>
		);

		const memo = screen.getByLabelText("Memo");
		expect(memo.tagName).toBe("TEXTAREA");
		expect(memo).toHaveValue("two flights\nfinal table on Sunday");

		await user.click(screen.getByRole("button", { name: "Save" }));

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
		const onSubmit = vi.fn();

		render(<TournamentForm onSubmit={onSubmit} />);

		fireEvent.change(screen.getByLabelText("Tournament Name *"), {
			target: { value: "Nightly Deepstack" },
		});
		fireEvent.change(screen.getByLabelText("Memo"), {
			target: { value: "late reg open\n15 minute levels" },
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Nightly Deepstack",
				memo: "late reg open\n15 minute levels",
				chipPurchases: [],
				tags: [],
			})
		);
	});

	it("blocks submit when the required Tournament Name is empty", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<TournamentForm onSubmit={onSubmit} />);
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits tags added through the combobox", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<TournamentForm onSubmit={onSubmit} />);

		fireEvent.change(screen.getByLabelText("Tournament Name *"), {
			target: { value: "Nightly Deepstack" },
		});
		await user.type(screen.getByLabelText("Search tags"), "Series");
		await user.keyboard("{Enter}");

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Nightly Deepstack",
				tags: ["Series"],
			})
		);
	});
});
