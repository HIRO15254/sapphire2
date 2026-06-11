import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AllInBottomSheet } from "./all-in-bottom-sheet";

const POT_SIZE_LABEL_PATTERN = /pot size/i;
const TRIALS_LABEL_PATTERN = /trials/i;
const EQUITY_LABEL_PATTERN = /equity %/i;
const WINS_LABEL_PATTERN = /wins/i;

// Stand-in for the v2 FormSheet: renders the title, the body, and the
// toolbar Save button that submits the inner form via the `form` attribute.
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

describe("AllInBottomSheet", () => {
	it("submits create-mode values via the sheet Save button", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<AllInBottomSheet onOpenChange={vi.fn()} onSubmit={onSubmit} open />
		);

		expect(
			screen.getByRole("heading", { name: "Add All-in" })
		).toBeInTheDocument();
		await user.clear(screen.getByLabelText(POT_SIZE_LABEL_PATTERN));
		await user.type(screen.getByLabelText(POT_SIZE_LABEL_PATTERN), "1200");
		await user.clear(screen.getByLabelText(TRIALS_LABEL_PATTERN));
		await user.type(screen.getByLabelText(TRIALS_LABEL_PATTERN), "2");
		await user.clear(screen.getByLabelText(EQUITY_LABEL_PATTERN));
		await user.type(screen.getByLabelText(EQUITY_LABEL_PATTERN), "25");
		await user.clear(screen.getByLabelText(WINS_LABEL_PATTERN));
		await user.type(screen.getByLabelText(WINS_LABEL_PATTERN), "0.5");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			equity: 25,
			potSize: 1200,
			trials: 2,
			wins: 0.5,
		});
	});

	it("shows edit-mode title and delete action and calls onDelete", async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(
			<AllInBottomSheet
				initialValues={{ equity: 40, potSize: 900, trials: 3, wins: 1 }}
				onDelete={onDelete}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);

		expect(screen.getByText("Edit All-in")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByDisplayValue("900")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("renders no delete action when onDelete is not provided", () => {
		render(<AllInBottomSheet onOpenChange={vi.fn()} onSubmit={vi.fn()} open />);
		expect(
			screen.queryByRole("button", { name: "Delete" })
		).not.toBeInTheDocument();
	});

	it("resets fields to initial values when opened", () => {
		render(
			<AllInBottomSheet
				initialValues={{ equity: 40, potSize: 900, trials: 3, wins: 1 }}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		expect(screen.getByLabelText(POT_SIZE_LABEL_PATTERN)).toHaveValue("900");
		expect(screen.getByLabelText(TRIALS_LABEL_PATTERN)).toHaveValue("3");
		expect(screen.getByLabelText(EQUITY_LABEL_PATTERN)).toHaveValue("40");
		expect(screen.getByLabelText(WINS_LABEL_PATTERN)).toHaveValue("1");
	});

	it("displays computed EV values", () => {
		render(
			<AllInBottomSheet
				initialValues={{ equity: 50, potSize: 1000, trials: 2, wins: 1 }}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);
		expect(screen.getByText("EV Amount: 500.00")).toBeInTheDocument();
		expect(screen.getByText("Actual: 500.00")).toBeInTheDocument();
		expect(screen.getByText("EV Diff: 0.00")).toBeInTheDocument();
	});
});
