import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { CashGameStackForm } from "./cash-game-stack-form";

const FORM_ID = "cash-game-stack-form-test";

const mocks = vi.hoisted(() => ({
	state: {
		stackAmount: "",
	},
	setStackAmount: vi.fn(),
}));

vi.mock("@/features/live-sessions/hooks/use-session-form", () => ({
	useStackFormContext: () => ({
		state: mocks.state,
		setStackAmount: mocks.setStackAmount,
	}),
}));

vi.mock("@/features/live-sessions/components/all-in-bottom-sheet", () => ({
	AllInBottomSheet: ({
		onSubmit,
		open,
	}: {
		onSubmit: (value: {
			equity: number;
			potSize: number;
			trials: number;
			wins: number;
		}) => void;
		open: boolean;
	}) =>
		open ? (
			<button
				onClick={() =>
					onSubmit({ equity: 40, potSize: 1200, trials: 2, wins: 1 })
				}
				type="button"
			>
				Mock Save All-in
			</button>
		) : null,
}));

vi.mock("@/features/live-sessions/components/addon-bottom-sheet", () => ({
	AddonBottomSheet: ({
		onSubmit,
		open,
	}: {
		onSubmit: (value: { amount: number }) => void;
		open: boolean;
	}) =>
		open ? (
			<button onClick={() => onSubmit({ amount: 300 })} type="button">
				Mock Save Addon
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
		children: React.ReactNode;
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

const defaultProps = {
	formId: FORM_ID,
	onAllIn: vi.fn(),
	onChipAdd: vi.fn(),
	onChipRemove: vi.fn(),
	onComplete: vi.fn(),
	onMemo: vi.fn(),
	onPause: vi.fn(),
	onSubmit: vi.fn(),
};

// The stack form is submitted by the surrounding FormSheet toolbar via the
// `form` attribute — mirror that with an external trigger button.
function renderForm(
	props: Partial<React.ComponentProps<typeof CashGameStackForm>> = {}
) {
	return render(
		<>
			<CashGameStackForm {...defaultProps} {...props} />
			<button form={FORM_ID} type="submit">
				submit-trigger
			</button>
		</>
	);
}

describe("CashGameStackForm", () => {
	it("renders stack field and primary actions without its own submit button", () => {
		mocks.state.stackAmount = "";

		renderForm();

		expect(screen.getByLabelText("Current Stack *")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Update" })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Complete" })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "All-in" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Add Chips" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Remove Chips" })
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Memo" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
	});

	it("assigns the formId to the stack form element", () => {
		mocks.state.stackAmount = "";
		renderForm();
		const form = document.getElementById(FORM_ID);
		expect(form).not.toBeNull();
		expect(form?.tagName).toBe("FORM");
	});

	it("calls onComplete with the current stack", async () => {
		const user = userEvent.setup();
		const onComplete = vi.fn();
		mocks.state.stackAmount = "4200";

		renderForm({ onComplete });

		await user.click(screen.getByRole("button", { name: "Complete" }));

		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onComplete).toHaveBeenCalledWith(4200);
	});

	it("submits stackAmount only via the external submit", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		mocks.state.stackAmount = "5000";

		renderForm({ onSubmit });

		await user.click(screen.getByRole("button", { name: "submit-trigger" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({ stackAmount: 5000 });
	});

	it("calls onAllIn immediately when all-in is submitted", async () => {
		const user = userEvent.setup();
		const onAllIn = vi.fn();
		mocks.state.stackAmount = "1000";

		renderForm({ onAllIn });

		await user.click(screen.getByRole("button", { name: "All-in" }));
		await user.click(screen.getByRole("button", { name: "Mock Save All-in" }));

		expect(onAllIn).toHaveBeenCalledWith({
			equity: 40,
			potSize: 1200,
			trials: 2,
			wins: 1,
		});
	});

	it("adds an addon and increments the stack through the shared flow", async () => {
		const user = userEvent.setup();
		const onChipAdd = vi.fn();
		mocks.state.stackAmount = "1000";

		renderForm({ onChipAdd });

		await user.click(screen.getByRole("button", { name: "Add Chips" }));
		await user.click(screen.getByRole("button", { name: "Mock Save Addon" }));

		expect(onChipAdd).toHaveBeenCalledWith(300);
		expect(mocks.setStackAmount).toHaveBeenCalledWith("1300");
	});

	it("calls onPause when the Pause button is clicked", async () => {
		const user = userEvent.setup();
		const onPause = vi.fn();
		mocks.state.stackAmount = "";

		renderForm({ onPause });

		await user.click(screen.getByRole("button", { name: "Pause" }));

		expect(onPause).toHaveBeenCalledOnce();
	});
});
