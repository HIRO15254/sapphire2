import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentForm } from "./tournament-form";

const gameVariantsMocks = vi.hoisted(() => ({
	variants: [
		{
			id: "v-nlh",
			name: "NLH",
			blindLabel1: "SB",
			blindLabel2: "BB",
			blindLabel3: "Straddle",
		},
		{
			id: "v-plo",
			name: "PLO",
			blindLabel1: "SB",
			blindLabel2: "BB",
			blindLabel3: "Straddle",
		},
	],
}));

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

vi.mock("@/features/game-variants/hooks/use-game-variants", () => ({
	useGameVariants: () => ({ variants: gameVariantsMocks.variants }),
}));

const FORM_ID = "tournament-form-test";

// The form renders no submit button of its own — the surrounding FormSheet
// owns Save and submits via the `form` attribute. Mirror that with an
// external button so the tests exercise the `id={formId}` wiring.
function renderForm(
	props: Partial<React.ComponentProps<typeof TournamentForm>>
) {
	const onSubmit = props.onSubmit ?? vi.fn();
	const result = render(
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
				variant: "NLH",
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
				variant: "NLH",
				variantId: "v-nlh",
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

		fireEvent.change(screen.getByLabelText("Tournament Name *"), {
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

	it("blocks submit when the required Tournament Name is empty", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits tags added through the combobox", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm({});

		fireEvent.change(screen.getByLabelText("Tournament Name *"), {
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

	describe("variant select", () => {
		it("renders an option per user-defined variant", () => {
			const { container } = renderForm({});
			const trigger = container.querySelector("button#variantId");
			const nativeSelect = trigger?.nextElementSibling;
			const options = Array.from(
				nativeSelect?.querySelectorAll("option") ?? []
			).map((el) => el.textContent);
			expect(options).toEqual(["NLH", "PLO"]);
		});

		it("defaults the select to the first variant in create mode", () => {
			renderForm({});
			expect(screen.getByLabelText("Variant *")).toHaveTextContent("NLH");
		});
	});
});
