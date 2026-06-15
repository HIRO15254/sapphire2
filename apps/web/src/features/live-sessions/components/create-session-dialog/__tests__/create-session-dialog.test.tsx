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

// The wizard pulls in the whole session form (and trpc) — stub it; this test
// only asserts the sheet chrome (title) the dialog wraps it in.
vi.mock("@/features/sessions/components/session-wizard", () => ({
	SessionWizard: () => <div data-testid="session-wizard" />,
}));

import { CreateSessionDialog } from "@/features/live-sessions/components/create-session-dialog/create-session-dialog";

function setup() {
	hooks.useCreateSessionDialog.mockReturnValue({
		rooms: [],
		currencies: [],
		ringGames: [],
		tournaments: [],
		setSelectedRoomId: vi.fn(),
		handleSubmit: vi.fn(),
		isLoading: false,
		handleReset: vi.fn(),
	});
}

describe("CreateSessionDialog", () => {
	it("titles the sheet 'Start Live Session' when open", () => {
		setup();
		render(<CreateSessionDialog onOpenChange={vi.fn()} open={true} />);
		// Title renders as both the visible DrawerTitle and an sr-only description.
		expect(screen.getAllByText("Start Live Session").length).toBeGreaterThan(0);
		expect(screen.getByTestId("session-wizard")).toBeInTheDocument();
	});

	it("renders nothing while closed", () => {
		setup();
		render(<CreateSessionDialog onOpenChange={vi.fn()} open={false} />);
		expect(screen.queryByTestId("session-wizard")).not.toBeInTheDocument();
	});
});
