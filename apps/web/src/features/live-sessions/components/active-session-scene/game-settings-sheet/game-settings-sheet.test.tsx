import { render, screen } from "@testing-library/react";
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

import { GameSettingsSheet } from "@/features/live-sessions/components/active-session-scene/game-settings-sheet";

describe("GameSettingsSheet", () => {
	it("does not mount the game scene while closed", () => {
		render(<GameSettingsSheet onOpenChange={vi.fn()} open={false} />);
		expect(screen.queryByTestId("game-scene")).not.toBeInTheDocument();
	});

	it("mounts the game scene when open", () => {
		render(<GameSettingsSheet onOpenChange={vi.fn()} open />);
		expect(screen.getByTestId("game-scene")).toBeInTheDocument();
	});

	it("exposes an accessible title", () => {
		render(<GameSettingsSheet onOpenChange={vi.fn()} open />);
		expect(screen.getByText("Game settings")).toBeInTheDocument();
	});
});
