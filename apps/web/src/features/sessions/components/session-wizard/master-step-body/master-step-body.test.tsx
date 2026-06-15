import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MasterStepBody } from "@/features/sessions/components/session-wizard/master-step-body/master-step-body";
import type { UseSessionWizardReturn } from "@/features/sessions/components/session-wizard/use-session-wizard";

const ROOMS = [{ id: "room-1", name: "My Casino" }];
const CUSTOMIZE_RE = /Customize rules/;

function makeState(
	overrides: Partial<UseSessionWizardReturn> = {}
): UseSessionWizardReturn {
	return {
		sessionType: "cash_game",
		setSessionType: vi.fn(),
		gameLabel: "Cash game",
		gameOptions: [],
		handleGameChange: vi.fn(),
		handleRoomChange: vi.fn(),
		selectedGameId: undefined,
		selectedRoomId: undefined,
		canCustomizeRules: false,
		customizeRules: vi.fn(),
		...overrides,
	} as unknown as UseSessionWizardReturn;
}

describe("MasterStepBody", () => {
	it("renders the session-type tabs and the room selector", () => {
		render(
			<MasterStepBody isLiveLinked={false} rooms={ROOMS} state={makeState()} />
		);
		expect(screen.getByText("Session type")).toBeInTheDocument();
		expect(screen.getByText("Cash game")).toBeInTheDocument();
		expect(screen.getByText("Tournament")).toBeInTheDocument();
		expect(screen.getByText("Room")).toBeInTheDocument();
	});

	it("hides the Customize rules button when canCustomizeRules is false", () => {
		render(
			<MasterStepBody
				isLiveLinked={false}
				rooms={ROOMS}
				state={makeState({ canCustomizeRules: false })}
			/>
		);
		expect(
			screen.queryByRole("button", { name: CUSTOMIZE_RE })
		).not.toBeInTheDocument();
	});

	it("shows Customize rules and invokes customizeRules once when clicked", async () => {
		const user = userEvent.setup();
		const customizeRules = vi.fn();
		render(
			<MasterStepBody
				isLiveLinked={false}
				rooms={ROOMS}
				state={makeState({ canCustomizeRules: true, customizeRules })}
			/>
		);
		const button = screen.getByRole("button", { name: CUSTOMIZE_RE });
		await user.click(button);
		expect(customizeRules).toHaveBeenCalledTimes(1);
	});
});
