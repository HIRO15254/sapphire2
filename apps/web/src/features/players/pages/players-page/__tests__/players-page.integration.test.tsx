import type { AppRouter } from "@sapphire2/api/routers/index";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type inferRouterInputs, initTRPC, TRPCError } from "@trpc/server";
import { setupServer } from "msw/node";
import { Toaster, toast } from "sonner";
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
import type { PlayerItem } from "@/features/players/hooks/use-players";
import { PlayersPage } from "@/features/players/pages/players-page/players-page";
import { queryClient } from "@/utils/trpc";

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://players.integration.test" },
}));

type CreatePlayerInput = inferRouterInputs<AppRouter>["player"]["create"];
type CreateTagInput = inferRouterInputs<AppRouter>["playerTag"]["create"];
const SEARCH_LABEL = "Search players by name or tag";
const PLAYER_NAME_LABEL = /Player name/;
const CAROL_LINK = /^Carol/;
const VIP = { id: "vip", name: "VIP", color: "blue" };
let tags: PlayerItem["tags"] = [];

function player(
	id: string,
	name: string,
	tags: PlayerItem["tags"] = []
): PlayerItem {
	return {
		id,
		name,
		tags,
		memo: null,
		isTemporary: false,
		userId: "integration-user",
		createdAt: "2026-09-05T00:00:00.000Z",
		updatedAt: "2026-09-05T00:00:00.000Z",
	};
}

const backend = {
	list: vi.fn<() => PlayerItem[] | Promise<PlayerItem[]>>(),
	create:
		vi.fn<(input: CreatePlayerInput) => PlayerItem | Promise<PlayerItem>>(),
};

const t = initTRPC.create({ isServer: true });
const fixtureRouter = t.router({
	player: t.router({
		list: t.procedure.query(() => backend.list()),
		create: t.procedure
			.input(z.custom<CreatePlayerInput>())
			.mutation(({ input }) => backend.create(input)),
	}),
	playerTag: t.router({
		list: t.procedure.query(() => tags),
		create: t.procedure
			.input(z.custom<CreateTagInput>())
			.mutation(({ input }) => {
				const created = { id: "regular", name: input.name, color: "gray" };
				tags.push(created);
				return created;
			}),
	}),
});
const server = setupServer(
	trpcHttpHandler("http://players.integration.test", fixtureRouter)
);

function renderPage() {
	return renderIntegrationPage(
		<>
			<PlayersPage />
			<Toaster />
		</>,
		{ path: "/players", queryClient }
	);
}

async function openCreate() {
	const user = userEvent.setup();
	await user.click(await screen.findByRole("button", { name: "New player" }));
	await screen.findByRole("dialog", { name: "New player" });
	return user;
}

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
	tags = [VIP];
	backend.list
		.mockReset()
		.mockReturnValue([
			player("alice", "Alice", [VIP]),
			player("vivian", "Vivian"),
			player("bob", "Bob"),
		]);
	backend.create.mockReset().mockImplementation((input) => {
		const created = player(
			"saved-player",
			input.name,
			tags.filter((tag) => input.tagIds?.includes(tag.id))
		);
		backend.list.mockReturnValue([created]);
		return created;
	});
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

describe("Players page through the tRPC HTTP boundary", () => {
	it("does not present a pending initial response as an empty account", async () => {
		const response = Promise.withResolvers<PlayerItem[]>();
		backend.list.mockReturnValueOnce(response.promise);
		renderPage();
		try {
			await waitFor(() => expect(backend.list).toHaveBeenCalledTimes(1));
			expect(screen.queryByText("No players yet")).not.toBeInTheDocument();
			expect(screen.queryByRole("link")).not.toBeInTheDocument();
		} finally {
			response.resolve([player("alice", "Alice")]);
		}
		expect(await screen.findByRole("link", { name: "Alice" })).toBeVisible();
	});

	it("searches fetched names and tags, normalizes input, and restores the list", async () => {
		const user = userEvent.setup();
		renderPage();
		expect(
			await screen.findByRole("link", { name: "Alice VIP" })
		).toHaveAttribute("href", "/players/alice");
		const search = screen.getByRole("textbox", { name: SEARCH_LABEL });
		await user.type(search, "  VI  ");
		expect(screen.getByRole("link", { name: "Alice VIP" })).toBeVisible();
		expect(screen.getByRole("link", { name: "Vivian" })).toBeVisible();
		expect(screen.queryByRole("link", { name: "Bob" })).not.toBeInTheDocument();

		await user.clear(search);
		await user.type(search, "  ALI  ");
		expect(screen.getByRole("link", { name: "Alice VIP" })).toBeVisible();
		expect(
			screen.queryByRole("link", { name: "Vivian" })
		).not.toBeInTheDocument();

		await user.clear(search);
		await user.type(search, "nobody");
		expect(screen.getByText("No players match your search")).toBeVisible();
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
		await user.clear(search);
		await user.type(search, "   ");
		expect(screen.getAllByRole("link")).toHaveLength(3);
	});

	it("opens the create form from the empty state and cancels without sending", async () => {
		const user = userEvent.setup();
		backend.list.mockReturnValue([]);
		renderPage();
		await screen.findByText("No players yet");
		await user.click(screen.getAllByRole("button", { name: "New player" })[1]);
		await user.type(screen.getByLabelText(PLAYER_NAME_LABEL), "Unsaved");
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(screen.getByText("No players yet")).toBeVisible();
		expect(backend.create).not.toHaveBeenCalled();
	});

	it("announces the required name error and does not send an invalid form", async () => {
		renderPage();
		await screen.findByRole("link", { name: "Bob" });
		const user = await openCreate();
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Name is required"
		);
		expect(
			screen.getByLabelText(PLAYER_NAME_LABEL)
		).toHaveAccessibleDescription("Name is required");
		expect(screen.getByRole("dialog", { name: "New player" })).toBeVisible();
		expect(backend.create).not.toHaveBeenCalled();
	});

	it("saves selected and newly created tags and prevents duplicate pending submits", async () => {
		const response = Promise.withResolvers<PlayerItem>();
		backend.create.mockReturnValueOnce(response.promise);
		renderPage();
		await screen.findByRole("link", { name: "Bob" });
		const user = await openCreate();
		await user.type(screen.getByLabelText(PLAYER_NAME_LABEL), "Carol");
		const tagInput = screen.getByRole("combobox", {
			name: "Search player tags",
		});
		await user.type(tagInput, "VIP");
		await user.click(await screen.findByRole("option", { name: "VIP" }));
		await user.type(tagInput, "Regular");
		await user.click(
			await screen.findByRole("option", { name: 'Create "Regular"' })
		);
		await screen.findByRole("button", { name: "Remove tag Regular" });
		try {
			await user.click(screen.getByRole("button", { name: "Save" }));
			await waitFor(() => expect(backend.create).toHaveBeenCalledTimes(1));
			expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
			expect(screen.getByRole("dialog", { name: "New player" })).toBeVisible();
			await user.click(screen.getByRole("button", { name: "Save" }));
			expect(backend.create).toHaveBeenCalledTimes(1);
			expect(backend.create).toHaveBeenCalledWith({
				name: "Carol",
				tagIds: ["vip", "regular"],
			});
		} finally {
			const created = player("saved-player", "Carol", tags);
			backend.list.mockReturnValue([created]);
			response.resolve(created);
		}
		await waitFor(() =>
			expect(screen.getByRole("link", { name: CAROL_LINK })).toHaveAttribute(
				"href",
				"/players/saved-player"
			)
		);
		const saved = screen.getByRole("link", { name: CAROL_LINK });
		expect(within(saved).getByText("VIP")).toBeVisible();
		expect(within(saved).getByText("Regular")).toBeVisible();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("preserves failed input and allows retry after a rejected server response", async () => {
		backend.create.mockRejectedValueOnce(
			new TRPCError({
				code: "FORBIDDEN",
				message: "Player creation was rejected",
			})
		);
		renderPage();
		await screen.findByRole("link", { name: "Bob" });
		const user = await openCreate();
		await user.type(screen.getByLabelText(PLAYER_NAME_LABEL), "Carol");
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(
			await screen.findByText("Player creation was rejected")
		).toBeVisible();
		const dialog = screen.getByRole("dialog", { name: "New player" });
		expect(within(dialog).getByLabelText(PLAYER_NAME_LABEL)).toHaveValue(
			"Carol"
		);
		expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled();
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(screen.getByRole("link", { name: "Carol" })).toHaveAttribute(
				"href",
				"/players/saved-player"
			)
		);
		expect(backend.create).toHaveBeenCalledTimes(2);
		expect(backend.create).toHaveBeenNthCalledWith(2, { name: "Carol" });
	});

	it("retries an initial HTTP error without showing an empty account", async () => {
		backend.list.mockRejectedValueOnce(
			new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Try again" })
		);
		const user = userEvent.setup();
		renderPage();
		expect(await screen.findByText("Unable to load players")).toBeVisible();
		expect(screen.queryByText("No players yet")).not.toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Retry", exact: true })
		);
		expect(await screen.findByRole("link", { name: "Bob" })).toBeVisible();
		expect(
			screen.queryByText("Unable to load players")
		).not.toBeInTheDocument();
	});
});
