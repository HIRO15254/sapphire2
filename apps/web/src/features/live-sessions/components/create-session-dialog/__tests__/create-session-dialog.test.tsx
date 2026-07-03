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

// The live form pulls in the session form fields (and trpc) — stub it; this
// test only asserts the sheet chrome (title) the dialog wraps it in.
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
	it("titles the sheet 'Start Live Session' and renders the live form when open", () => {
		setup();
		render(<CreateSessionDialog onOpenChange={vi.fn()} open={true} />);
		// Title renders as both the visible DrawerTitle and an sr-only description.
		expect(screen.getAllByText("Start Live Session").length).toBeGreaterThan(0);
		expect(screen.getByTestId("live-session-form")).toBeInTheDocument();
	});

	it("renders nothing while closed", () => {
		setup();
		render(<CreateSessionDialog onOpenChange={vi.fn()} open={false} />);
		expect(screen.queryByTestId("live-session-form")).not.toBeInTheDocument();
	});
});
