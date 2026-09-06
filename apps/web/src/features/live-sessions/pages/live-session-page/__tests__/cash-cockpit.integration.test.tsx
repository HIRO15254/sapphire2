import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initTRPC } from "@trpc/server";
import { setupServer } from "msw/node";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import z from "zod";
import {
	renderIntegrationPage,
	trpcHttpHandler,
} from "@/__tests__/integration";
import { CashCockpit } from "@/features/live-sessions/pages/live-session-page/cash-cockpit";
import { queryClient } from "@/utils/trpc";

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://cockpit.integration.test" },
}));

const SESSION_ID = "cash-1";
const STACK_LABEL = "Current stack";

interface CreatedEvent {
	eventType: string;
	payload: Record<string, unknown>;
}

const backend = {
	createdEvents: [] as CreatedEvent[],
	currentStack: 12_000 as number | null,
	status: "active",
};

function session() {
	return {
		id: SESSION_ID,
		status: backend.status,
		startedAt: new Date("2026-06-01T10:00:00Z"),
		roomId: null,
		ringGameId: null,
		ruleName: "Friday 200/400",
		variant: "NLH",
		blind2: 400,
		tableSize: 6,
		heroSeatPosition: null,
		memo: null,
		events: [
			{
				eventType: "session_start",
				occurredAt: new Date("2026-06-01T10:00:00Z"),
			},
		],
		summary: {
			chipRemoveTotal: 0,
			currentStack: backend.currentStack,
			evDiff: 0,
			totalBuyIn: 10_000,
		},
	};
}

const t = initTRPC.create({ isServer: true });
const fixtureRouter = t.router({
	liveCashGameSession: t.router({
		getById: t.procedure.input(z.custom()).query(() => session()),
	}),
	sessionTablePlayer: t.router({
		list: t.procedure.input(z.custom()).query(() => []),
	}),
	player: t.router({
		list: t.procedure.query(() => []),
	}),
	sessionEvent: t.router({
		create: t.procedure
			.input(z.custom<CreatedEvent>())
			.mutation(({ input }) => {
				backend.createdEvents.push(input);
				if (input.eventType === "update_stack") {
					backend.currentStack = Number(input.payload.stackAmount);
				}
				return { id: "evt-1" };
			}),
	}),
});

const server = setupServer(
	trpcHttpHandler("http://cockpit.integration.test", fixtureRouter)
);

const originalViewport = Object.getOwnPropertyDescriptor(
	window,
	"visualViewport"
);

function stubVisualViewport(height: number) {
	const listeners = new Set<() => void>();
	const viewport = {
		height,
		addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
		removeEventListener: (_type: string, fn: () => void) =>
			listeners.delete(fn),
	};
	Object.defineProperty(window, "visualViewport", {
		configurable: true,
		value: viewport,
	});
	return {
		resizeTo(next: number) {
			viewport.height = next;
			act(() => {
				for (const fn of listeners) {
					fn();
				}
			});
		},
	};
}

function renderCockpit() {
	return renderIntegrationPage(<CashCockpit sessionId={SESSION_ID} />, {
		path: "/active-session-next",
		queryClient,
	});
}

beforeAll(() => {
	server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
	queryClient.clear();
	queryClient.setDefaultOptions({
		queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
		mutations: { retry: false },
	});
	backend.createdEvents = [];
	backend.currentStack = 12_000;
	backend.status = "active";
});

afterEach(() => {
	cleanup();
	server.resetHandlers();
	if (originalViewport) {
		Object.defineProperty(window, "visualViewport", originalViewport);
	} else {
		Reflect.deleteProperty(window, "visualViewport");
	}
});

afterAll(() => {
	server.close();
});

describe("CashCockpit", () => {
	it("shows the session's stack, result and big-blind count", async () => {
		renderCockpit();
		expect(await screen.findByText("12,000")).toBeInTheDocument();
		expect(screen.getByText("+2,000")).toBeInTheDocument();
		expect(screen.getByText("30 BB")).toBeInTheDocument();
		expect(screen.getByText("Friday 200/400")).toBeInTheDocument();
	});

	it("records a stack update and follows the new value", async () => {
		const user = userEvent.setup();
		renderCockpit();

		const input = await screen.findByLabelText(STACK_LABEL);
		await user.clear(input);
		await user.type(input, "18000");
		await user.click(screen.getByRole("button", { name: "Save stack" }));

		await waitFor(() => {
			expect(backend.createdEvents).toEqual([
				{
					liveCashGameSessionId: SESSION_ID,
					eventType: "update_stack",
					payload: { stackAmount: 18_000 },
				},
			]);
		});
		expect(await screen.findByText("18,000")).toBeInTheDocument();
		expect(await screen.findByText("+8,000")).toBeInTheDocument();
	});

	it("rejects a blank stack without calling the server", async () => {
		const user = userEvent.setup();
		renderCockpit();

		const input = await screen.findByLabelText(STACK_LABEL);
		await user.clear(input);
		await user.click(screen.getByRole("button", { name: "Save stack" }));

		expect(await screen.findByRole("alert")).toBeInTheDocument();
		expect(screen.getByLabelText(STACK_LABEL)).toHaveAttribute(
			"aria-invalid",
			"true"
		);
		expect(backend.createdEvents).toEqual([]);
	});

	it("follows a stack the server recorded elsewhere", async () => {
		renderCockpit();
		expect(await screen.findByLabelText(STACK_LABEL)).toHaveValue("12000");

		backend.currentStack = 24_500;
		await act(async () => {
			await queryClient.invalidateQueries();
		});

		await waitFor(() => {
			expect(screen.getByLabelText(STACK_LABEL)).toHaveValue("24500");
		});
	});

	it("hides the table while the keyboard is open so the input stays visible", async () => {
		const viewport = stubVisualViewport(800);
		renderCockpit();
		expect(await screen.findByText("30 BB")).toBeInTheDocument();

		viewport.resizeTo(430);

		expect(screen.queryByText("30 BB")).not.toBeInTheDocument();
		expect(screen.getByLabelText(STACK_LABEL)).toBeInTheDocument();

		viewport.resizeTo(800);
		expect(screen.getByText("30 BB")).toBeInTheDocument();
	});

	it("blocks stack entry while the session is paused and offers Resume", async () => {
		backend.status = "paused";
		renderCockpit();

		expect(await screen.findByText("Session paused")).toBeInTheDocument();
		expect(screen.queryByText("Paused")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
		expect(screen.getByLabelText(STACK_LABEL)).toBeDisabled();
		expect(screen.getByRole("button", { name: "Save stack" })).toBeDisabled();
	});
});
