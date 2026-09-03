import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
	useCreateSessionDialog: vi.fn(),
}));

vi.mock(
	"@/features/live-sessions/components/create-session-dialog/use-create-session-dialog",
	() => ({
		useCreateSessionDialog: (args: { onOpenChange: (open: boolean) => void }) =>
			hooks.useCreateSessionDialog(args),
	})
);

vi.mock(
	"@/features/live-sessions/components/create-session-dialog/live-session-form",
	() => ({
		LiveSessionForm: () => <div data-testid="live-session-form" />,
	})
);

import { CreateSessionDialog } from "@/features/live-sessions/components/create-session-dialog/create-session-dialog";

function setup() {
	hooks.useCreateSessionDialog.mockReturnValue({
		rooms: [],
		currencies: [],
		ringGames: [],
		tournaments: [],
		setSelectedRoomId: vi.fn(),
		handleSubmit: vi.fn(),
		locationPrompt: {
			open: false,
			roomName: "",
			onSave: vi.fn(),
			onSkip: vi.fn(),
			onOpenChange: vi.fn(),
		},
		isLoading: false,
		handleReset: vi.fn(),
	});
}

describe("CreateSessionDialog", () => {
	it("mounts the titled sheet with the live form only while open", () => {
		setup();
		const { unmount } = render(
			<CreateSessionDialog onOpenChange={vi.fn()} open={true} />
		);
		expect(screen.getAllByText("Start Live Session").length).toBeGreaterThan(0);
		expect(screen.getByTestId("live-session-form")).toBeInTheDocument();

		unmount();
		render(<CreateSessionDialog onOpenChange={vi.fn()} open={false} />);
		expect(screen.queryByTestId("live-session-form")).not.toBeInTheDocument();
	});
});
