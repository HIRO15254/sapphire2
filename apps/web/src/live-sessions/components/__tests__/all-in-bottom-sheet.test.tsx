import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AllInBottomSheet } from "../all-in-bottom-sheet";

const POT_SIZE_LABEL_PATTERN = /pot size/i;
const TRIALS_LABEL_PATTERN = /trials/i;
const EQUITY_LABEL_PATTERN = /equity %/i;
const WINS_LABEL_PATTERN = /wins/i;

vi.mock("@/shared/components/ui/responsive-dialog", () => ({
	ResponsiveDialog: ({
		children,
		open,
		title,
	}: {
		children: ReactNode;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div>
				<h2>{title}</h2>
				{children}
			</div>
		) : null,
}));

describe("AllInBottomSheet", () => {
	it("submits create-mode values with the add label", async () => {
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
		await user.click(screen.getByRole("button", { name: "Add All-in" }));

		expect(onSubmit).toHaveBeenCalledWith({
			equity: 25,
			potSize: 1200,
			trials: 2,
			wins: 0.5,
		});
	});

	it("shows edit-mode actions including delete", () => {
		render(
			<AllInBottomSheet
				initialValues={{ equity: 40, potSize: 900, trials: 3, wins: 1 }}
				onDelete={vi.fn()}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
			/>
		);

		expect(screen.getByText("Edit All-in")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
		expect(screen.getByDisplayValue("900")).toBeInTheDocument();
	});
});
