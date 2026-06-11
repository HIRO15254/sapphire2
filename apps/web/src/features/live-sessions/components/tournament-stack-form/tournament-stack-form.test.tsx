import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { TournamentStackForm } from "./tournament-stack-form";

const FORM_ID = "tournament-stack-form-test";

const mocks = vi.hoisted(() => ({
	setStackAmount: vi.fn(),
	state: {
		chipPurchaseCounts: [] as Array<{
			chipsPerUnit: number;
			count: number;
			name: string;
		}>,
		remainingPlayers: "",
		stackAmount: "",
		totalEntries: "",
	},
}));

vi.mock("@/features/live-sessions/hooks/use-session-form", () => ({
	useTournamentFormContext: () => ({
		setChipPurchaseCounts: vi.fn(),
		setRemainingPlayers: vi.fn(),
		setStackAmount: mocks.setStackAmount,
		setTotalEntries: vi.fn(),
		state: mocks.state,
	}),
}));

vi.mock("@/features/live-sessions/components/chip-purchase-sheet", () => ({
	ChipPurchaseSheet: ({
		onSubmit,
		open,
	}: {
		onSubmit: (value: {
			chips: number;
			cost: number;
			name: string;
			sessionChipPurchaseId: string;
		}) => void;
		open: boolean;
	}) =>
		open ? (
			<button
				onClick={() =>
					onSubmit({
						sessionChipPurchaseId: "cp1",
						chips: 10_000,
						cost: 5000,
						name: "Rebuy",
					})
				}
				type="button"
			>
				Mock Purchase
			</button>
		) : null,
}));

// Stand-in for the v2 FormSheet that hosts the memo form: renders the title,
// the body, and the toolbar Save button submitting via the `form` attribute.
vi.mock("@/shared/components/form-sheet", () => ({
	FormSheet: ({
		children,
		formId,
		open,
		title,
	}: {
		children: ReactNode;
		formId: string;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{children}
				<button aria-label="Save" form={formId} type="submit">
					Save
				</button>
			</div>
		) : null,
}));

const CHIP_PURCHASE_TYPES = [
	{ id: "cp1", name: "Rebuy", cost: 5000, chips: 10_000 },
	{ id: "cp2", name: "Addon", cost: 3000, chips: 8000 },
];

const defaultProps = {
	formId: FORM_ID,
	onComplete: vi.fn(),
	onMemo: vi.fn(),
	onPause: vi.fn(),
	onPurchaseChips: vi.fn(),
	onSubmit: vi.fn(),
};

// The stack form is submitted by the surrounding FormSheet toolbar via the
// `form` attribute — mirror that with an external trigger button.
function renderForm(
	props: Partial<React.ComponentProps<typeof TournamentStackForm>> = {}
) {
	return render(
		<>
			<TournamentStackForm {...defaultProps} {...props} />
			<button form={FORM_ID} type="submit">
				submit-trigger
			</button>
		</>
	);
}

describe("TournamentStackForm", () => {
	it("renders stack input and action buttons without its own submit button", () => {
		mocks.state.stackAmount = "";

		renderForm({ chipPurchaseTypes: CHIP_PURCHASE_TYPES });

		expect(screen.getByLabelText("Current Stack *")).toBeInTheDocument();
		expect(screen.queryByText("Update")).not.toBeInTheDocument();
		expect(screen.getByText("Complete")).toBeInTheDocument();
		expect(screen.getByText("Memo")).toBeInTheDocument();
		expect(screen.getByText("Pause")).toBeInTheDocument();
	});

	it("assigns the formId to the stack form element", () => {
		mocks.state.stackAmount = "";
		renderForm();
		const form = document.getElementById(FORM_ID);
		expect(form).not.toBeNull();
		expect(form?.tagName).toBe("FORM");
	});

	it("renders chip purchase count fields when types provided", () => {
		mocks.state.stackAmount = "";

		renderForm({ chipPurchaseTypes: CHIP_PURCHASE_TYPES });

		expect(screen.getByLabelText("Rebuy count")).toBeInTheDocument();
		expect(screen.getByLabelText("Addon count")).toBeInTheDocument();
	});

	it("shows no chip purchase count fields when no types provided", () => {
		mocks.state.stackAmount = "";

		renderForm();

		expect(screen.queryByLabelText("Rebuy count")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Addon count")).not.toBeInTheDocument();
	});

	it("renders remaining players and total entries fields by default", () => {
		mocks.state.stackAmount = "";

		renderForm({ chipPurchaseTypes: CHIP_PURCHASE_TYPES });

		expect(screen.getByLabelText("Remaining Players")).toBeInTheDocument();
		expect(screen.getByLabelText("Total Entries")).toBeInTheDocument();
	});

	it("calls onComplete when Complete is clicked", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		mocks.state.stackAmount = "";

		renderForm({ onComplete });

		await user.click(screen.getByText("Complete"));
		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it("calls onPause when Pause is clicked", async () => {
		const user = userEvent.setup();
		const onPause = vi.fn();
		mocks.state.stackAmount = "";

		renderForm({ onPause });

		await user.click(screen.getByText("Pause"));
		expect(onPause).toHaveBeenCalledTimes(1);
	});

	it("calls onPurchaseChips via chip purchase sheet", async () => {
		const user = userEvent.setup();
		const onPurchaseChips = vi.fn();
		mocks.state.stackAmount = "1200";

		renderForm({
			chipPurchaseTypes: CHIP_PURCHASE_TYPES,
			onPurchaseChips,
		});

		await user.click(screen.getByText("Chip Purchase"));
		await user.click(screen.getByText("Mock Purchase"));

		expect(onPurchaseChips).toHaveBeenCalledTimes(1);
		expect(onPurchaseChips).toHaveBeenCalledWith({
			sessionChipPurchaseId: "cp1",
			chips: 10_000,
			cost: 5000,
			name: "Rebuy",
		});
	});

	it("submits form values via the external submit", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		mocks.state.stackAmount = "8000";

		renderForm({
			chipPurchaseTypes: CHIP_PURCHASE_TYPES,
			onSubmit,
		});

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ stackAmount: 8000 })
		);
	});
});
