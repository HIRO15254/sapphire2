import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const sceneSpy = vi.hoisted(() =>
	vi.fn(() => <div data-testid="game-scene" />)
);

vi.mock(
	"@/features/live-sessions/components/active-session-game-scene",
	() => ({
		ActiveSessionGameScene: () => sceneSpy(),
	})
);

import { RuleSheet } from "./rule-sheet";

describe("RuleSheet", () => {
	it("does not mount the game scene while closed", () => {
		render(<RuleSheet onOpenChange={vi.fn()} open={false} />);
		expect(screen.queryByTestId("game-scene")).not.toBeInTheDocument();
	});

	it("mounts the game scene when open", () => {
		render(<RuleSheet onOpenChange={vi.fn()} open />);
		expect(screen.getByTestId("game-scene")).toBeInTheDocument();
	});

	it("exposes an accessible title", () => {
		render(<RuleSheet onOpenChange={vi.fn()} open />);
		expect(
			screen.getByRole("heading", { name: "Session" })
		).toBeInTheDocument();
	});

	it("calls onOpenChange(false) exactly once when the close button is tapped", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(<RuleSheet onOpenChange={onOpenChange} open />);
		await user.click(screen.getByRole("button", { name: "Close" }));
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("shows the snapshot hint line below the game scene when open", () => {
		render(<RuleSheet onOpenChange={vi.fn()} open />);
		expect(
			screen.getByText(
				"Rules are a snapshot taken when the session was created. Edits apply to this session only."
			)
		).toBeInTheDocument();
	});

	it("does not show the snapshot hint line while closed", () => {
		render(<RuleSheet onOpenChange={vi.fn()} open={false} />);
		expect(
			screen.queryByText(
				"Rules are a snapshot taken when the session was created. Edits apply to this session only."
			)
		).not.toBeInTheDocument();
	});
});
