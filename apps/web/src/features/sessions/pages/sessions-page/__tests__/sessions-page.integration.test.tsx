import type { AppRouter } from "@sapphire2/api/routers/index";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type inferRouterInputs, initTRPC, TRPCError } from "@trpc/server";
import { setupServer } from "msw/node";
import { Toaster, toast } from "sonner";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	expect,
	it,
	onTestFinished,
	vi,
} from "vitest";
import z from "zod";
import {
	renderIntegrationPage,
	trpcHttpHandler,
} from "@/__tests__/integration";
import { SessionsPage } from "@/features/sessions/pages/sessions-page/sessions-page";
import { queryClient } from "@/utils/trpc";

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://sessions.integration.test" },
}));

type CreateSessionInput = inferRouterInputs<AppRouter>["session"]["create"];
const BUY_IN_LABEL = /^Buy-in/;
const CASH_OUT_LABEL = /^Cash-out/;
const create = vi.fn<(input: CreateSessionInput) => Promise<{ id: string }>>();
const t = initTRPC.create({ isServer: true });
const emptyList = t.procedure.query(() => []);
const fixtureRouter = t.router({
	session: t.router({
		list: t.procedure.query(() => ({ items: [], nextCursor: undefined })),
		create: t.procedure
			.input(z.custom<CreateSessionInput>())
			.mutation(({ input }) => create(input)),
	}),
	sessionTag: t.router({ list: emptyList }),
	room: t.router({
		list: t.procedure.query(() => [{ id: "r1", name: "Aria" }]),
	}),
	currency: t.router({ list: emptyList }),
	filterPreset: t.router({ list: emptyList }),
	gameGroup: t.router({ list: emptyList }),
	gameVariant: t.router({ list: emptyList }),
	gameMix: t.router({ list: emptyList }),
	ringGame: t.router({ listByRoom: emptyList }),
	tournament: t.router({ listByRoom: emptyList }),
});
const server = setupServer(
	trpcHttpHandler("http://sessions.integration.test", fixtureRouter)
);

beforeAll(() => {
	server.listen({ onUnhandledRequest: "error" });
	vi.stubGlobal("scrollTo", vi.fn());
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}))
	);
});

beforeEach(() => {
	queryClient.clear();
	queryClient.setDefaultOptions({
		queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
		mutations: { retry: false },
	});
	create.mockReset().mockResolvedValue({ id: "saved-session" });
});

afterEach(async () => {
	cleanup();
	await queryClient.cancelQueries();
	queryClient.clear();
	toast.dismiss();
	server.resetHandlers();
});

afterAll(() => {
	server.close();
	vi.unstubAllGlobals();
});

it("keeps failed session input and the sheet open, then closes after a successful retry", async () => {
	const response = Promise.withResolvers<{ id: string }>();
	onTestFinished(() => response.resolve({ id: "saved-session" }));
	create.mockReturnValueOnce(response.promise);
	renderIntegrationPage(
		<>
			<SessionsPage />
			<Toaster />
		</>,
		{ path: "/sessions", queryClient }
	);
	const user = userEvent.setup();
	await user.click(
		(await screen.findAllByRole("button", { name: "New session" }))[0]
	);
	const dialog = await screen.findByRole("dialog", { name: "New session" });
	await user.click(await within(dialog).findByRole("combobox"));
	await user.click(await screen.findByRole("option", { name: "Aria" }));
	await user.click(within(dialog).getByRole("button", { name: "Next" }));
	await user.click(within(dialog).getByRole("button", { name: "Next" }));
	await user.type(within(dialog).getByLabelText(BUY_IN_LABEL), "100");
	await user.type(within(dialog).getByLabelText(CASH_OUT_LABEL), "250");
	await user.type(
		within(dialog).getByRole("textbox", { name: "Memo" }),
		"Keep this note"
	);
	await user.click(within(dialog).getByRole("button", { name: "Save" }));
	await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
	expect(
		within(dialog).getByRole("button", { name: "Save..." })
	).toBeDisabled();
	act(() => {
		response.reject(
			new TRPCError({
				code: "FORBIDDEN",
				message: "Session creation was rejected",
			})
		);
	});
	expect(
		await screen.findByText("Session creation was rejected")
	).toBeVisible();
	expect(dialog).toBeVisible();
	expect(within(dialog).getByLabelText(BUY_IN_LABEL)).toHaveValue("100");
	expect(within(dialog).getByLabelText(CASH_OUT_LABEL)).toHaveValue("250");
	expect(within(dialog).getByRole("textbox", { name: "Memo" })).toHaveValue(
		"Keep this note"
	);
	await user.click(within(dialog).getByRole("button", { name: "Save" }));
	await waitFor(() =>
		expect(screen.queryByRole("dialog", { name: "New session" })).toBeNull()
	);
	expect(create).toHaveBeenCalledTimes(2);
	expect(create).toHaveBeenNthCalledWith(
		2,
		expect.objectContaining({
			type: "cash_game",
			roomId: "r1",
			buyIn: 100,
			cashOut: 250,
			memo: "Keep this note",
		})
	);
});
