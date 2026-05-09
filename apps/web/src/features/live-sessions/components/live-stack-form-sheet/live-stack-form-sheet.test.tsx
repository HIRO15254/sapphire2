import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LiveStackFormSheet } from "./live-stack-form-sheet";

const mocks = vi.hoisted(() => ({
	activeSession: null as null | {
		id: string;
		kind: "cash_game" | "tournament";
	},
	chipPurchaseTypes: [] as Array<{
		id: number;
		chips: number;
		cost: number;
		name: string;
	}>,
	sessionData: null as null | { tournamentId: string | null },
	stackSheet: {
		close: vi.fn(),
		isOpen: true,
		open: vi.fn(),
		setIsOpen: vi.fn(),
	},
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		isPending: false,
		mutate: vi.fn(),
	}),
	useQuery: (options: { queryKey?: unknown[] }) => {
		const scope = options.queryKey?.[0];
		if (scope === "liveSession.getById") {
			return { data: mocks.sessionData };
		}
		return { data: undefined };
	},
	useQueryClient: () => ({
		invalidateQueries: vi.fn(),
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-active-session", () => ({
	useActiveSession: () => ({
		activeSession: mocks.activeSession,
	}),
}));

vi.mock("@/features/live-sessions/hooks/use-stack-sheet", () => ({
	useStackSheet: () => mocks.stackSheet,
}));

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

vi.mock("@/features/live-sessions/components/stack-form", () => ({
	StackForm: ({
		onComplete,
		kind,
	}: {
		kind: "cash_game" | "tournament";
		onComplete: (stack: number) => void;
	}) => (
		<button onClick={() => onComplete(4500)} type="button">
			{kind === "cash_game" ? "Open Cash Complete" : "Open Tournament Complete"}
		</button>
	),
}));

vi.mock("@/features/live-sessions/components/complete-session-form", () => ({
	CompleteSessionForm: ({ kind }: { kind: "cash_game" | "tournament" }) => (
		<div>
			{kind === "cash_game" ? "Cash Complete Form" : "Tournament Complete Form"}
		</div>
	),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["liveSession.getById", id],
				}),
			},
		},
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: ["session.list", input],
				}),
			},
		},
		sessionEvent: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: ["sessionEvent.list", input],
				}),
			},
		},
	},
	trpcClient: {
		liveSession: {
			complete: { mutate: vi.fn() },
		},
		sessionEvent: {
			create: { mutate: vi.fn() },
		},
	},
}));

describe("LiveStackFormSheet", () => {
	it("renders the cash stack dialog and opens the complete flow", async () => {
		const user = userEvent.setup();
		mocks.activeSession = { id: "cash-1", kind: "cash_game" };

		render(<LiveStackFormSheet />);

		expect(screen.getByText("Record Stack")).toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: "Open Cash Complete" })
		);

		expect(screen.getByText("Complete Session")).toBeInTheDocument();
		expect(screen.getByText("Cash Complete Form")).toBeInTheDocument();
	});

	it("renders the tournament stack dialog and opens the complete flow", async () => {
		const user = userEvent.setup();
		mocks.activeSession = { id: "tournament-1", kind: "tournament" };
		mocks.sessionData = { tournamentId: "tour-1" };

		render(<LiveStackFormSheet />);

		expect(screen.getByText("Record Stack")).toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: "Open Tournament Complete" })
		);

		expect(screen.getByText("Complete Tournament")).toBeInTheDocument();
		expect(screen.getByText("Tournament Complete Form")).toBeInTheDocument();
	});
});
