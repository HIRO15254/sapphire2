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
	it("renders one chip purchase count field per type and none without types", () => {
		mocks.state.stackAmount = "";
		const { rerender } = renderForm({ chipPurchaseTypes: CHIP_PURCHASE_TYPES });
		expect(screen.getByLabelText("Rebuy count")).toBeInTheDocument();
		expect(screen.getByLabelText("Addon count")).toBeInTheDocument();

		rerender(<TournamentStackForm {...defaultProps} />);
		expect(screen.queryByLabelText("Rebuy count")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Addon count")).not.toBeInTheDocument();
	});

	it("shows the tournament info fields while Record tournament info is checked", async () => {
		const user = userEvent.setup();
		mocks.state.stackAmount = "";
		renderForm({ chipPurchaseTypes: CHIP_PURCHASE_TYPES });
		expect(screen.getByLabelText("Remaining Players")).toBeInTheDocument();
		expect(screen.getByLabelText("Total Entries")).toBeInTheDocument();

		await user.click(screen.getByLabelText("Record tournament info"));
		expect(
			screen.queryByLabelText("Remaining Players")
		).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Total Entries")).not.toBeInTheDocument();
	});

	it.each([
		["Complete", "onComplete"],
		["Pause", "onPause"],
	] as const)("clicking %s calls %s", async (label, prop) => {
		const user = userEvent.setup();
		const handler = vi.fn();
		mocks.state.stackAmount = "";
		renderForm({ [prop]: handler });
		await user.click(screen.getByRole("button", { name: label }));
		expect(handler).toHaveBeenCalledTimes(1);
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
