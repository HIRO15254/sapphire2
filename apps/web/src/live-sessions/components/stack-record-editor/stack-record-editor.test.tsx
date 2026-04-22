import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StackRecordEditor } from "./stack-record-editor";

const STACK_AMOUNT_LABEL_PATTERN = /stack amount/i;

vi.mock("@/live-sessions/components/all-in-bottom-sheet", () => ({
	AllInBottomSheet: () => null,
}));

describe("StackRecordEditor", () => {
	it("blocks save for an invalid time and submits the same payload shape when corrected", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(
			<StackRecordEditor
				initialOccurredAt="2026-04-04T10:30:00"
				initialPayload={{ allIns: [], stackAmount: 4000 }}
				isLoading={false}
				maxTime={new Date("2026-04-04T10:45:00")}
				minTime={new Date("2026-04-04T10:15:00")}
				onSubmit={onSubmit}
			/>
		);

		await user.clear(screen.getByLabelText("Time"));
		await user.type(screen.getByLabelText("Time"), "10:00");

		expect(screen.getByText("Must be after 10:15")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

		await user.clear(screen.getByLabelText("Time"));
		await user.type(screen.getByLabelText("Time"), "10:40");
		await user.clear(screen.getByLabelText(STACK_AMOUNT_LABEL_PATTERN));
		await user.type(screen.getByLabelText(STACK_AMOUNT_LABEL_PATTERN), "5500");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(onSubmit).toHaveBeenCalledWith(
			{ allIns: [], stackAmount: 5500 },
			Math.floor(new Date("2026-04-04T10:40:00").getTime() / 1000)
		);
	});
});
