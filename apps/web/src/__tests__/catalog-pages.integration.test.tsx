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
import { CurrenciesPage } from "@/features/currencies/pages/currencies-page/currencies-page";
import { RoomsPage } from "@/features/rooms/pages/rooms-page/rooms-page";
import { queryClient } from "@/utils/trpc";

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://catalog.integration.test" },
}));

type CreateInput =
	| inferRouterInputs<AppRouter>["currency"]["create"]
	| inferRouterInputs<AppRouter>["room"]["create"];
function item(id: string, name: string, isFavorite = false) {
	return {
		id,
		name,
		isFavorite,
		createdAt: "2026-09-05T00:00:00.000Z",
		balance: 0,
		unit: null,
		description: null,
		memo: null,
		latitude: null,
		longitude: null,
		ringGameCount: 0,
		tournamentCount: 0,
	};
}
type Item = ReturnType<typeof item>;
const REQUIRED_ERROR = /required/;
const backend = {
	list: vi.fn<() => Item[] | Promise<Item[]>>(),
	create: vi.fn<(input: CreateInput) => Item | Promise<Item>>(),
	toggle: vi.fn<(input: { id: string }) => Item | Promise<Item>>(),
};
const t = initTRPC.create({ isServer: true });
// This fixture controls only HTTP responses; server ownership and persistence
// are verified by the API integration suite.
const resource = t.router({
	list: t.procedure.query(() => backend.list()),
	create: t.procedure
		.input(z.custom<CreateInput>())
		.mutation(({ input }) => backend.create(input)),
	toggleFavorite: t.procedure
		.input(z.custom<{ id: string }>())
		.mutation(({ input }) => backend.toggle(input)),
});
const server = setupServer(
	trpcHttpHandler(
		"http://catalog.integration.test",
		t.router({ currency: resource, room: resource })
	)
);

beforeAll(() => {
	server.listen({ onUnhandledRequest: "error" });
	vi.stubGlobal("scrollTo", vi.fn());
});
beforeEach(() => {
	queryClient.clear();
	queryClient.setDefaultOptions({
		queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
		mutations: { retry: false },
	});
	backend.list.mockReset().mockReturnValue([item("existing", "Existing")]);
	backend.create.mockReset().mockImplementation((input) => {
		const created = item("saved", input.name);
		backend.list.mockReturnValue([created]);
		return created;
	});
	backend.toggle.mockReset().mockImplementation(({ id }) => {
		const toggled = item(id, "Existing", true);
		backend.list.mockReturnValue([toggled]);
		return toggled;
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

describe.each([
	{
		title: "Currencies",
		path: "/currencies",
		action: "New currency",
		field: /Currency name/,
		empty: "No currencies yet",
		failure: "Unable to load currencies",
		Page: CurrenciesPage,
	},
	{
		title: "Rooms",
		path: "/rooms",
		action: "New room",
		field: /Room name/,
		empty: "No rooms yet",
		failure: "Unable to load rooms",
		Page: RoomsPage,
	},
])("$title page through tRPC HTTP", ({
	title,
	path,
	action,
	field,
	empty,
	failure,
	Page,
}) => {
	function renderPage() {
		return renderIntegrationPage(
			<>
				<Page />
				<Toaster />
			</>,
			{ path, queryClient }
		);
	}

	it("waits for the list response and links to the returned item", async () => {
		const response = Promise.withResolvers<Item[]>();
		backend.list.mockReturnValue(response.promise);
		renderPage();
		expect(await screen.findByRole("heading", { name: title })).toBeVisible();
		expect(screen.queryByText(empty)).not.toBeInTheDocument();
		await act(async () => {
			response.resolve([item("existing", "Existing")]);
			await response.promise;
		});
		expect(await screen.findByRole("link")).toHaveAttribute(
			"href",
			`${path}/existing`
		);
	});

	it("opens from the empty state and cancels without submitting", async () => {
		backend.list.mockReturnValue([]);
		const user = userEvent.setup();
		renderPage();
		await screen.findByText(empty);
		await user.click(screen.getAllByRole("button", { name: action })[1]);
		await user.type(screen.getByLabelText(field), "Unsaved");
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(backend.create).not.toHaveBeenCalled();
	});

	it("blocks an empty name before sending the form", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByRole("link");
		await user.click(screen.getByRole("button", { name: action }));
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("required");
		expect(screen.getByLabelText(field)).toHaveAccessibleDescription(
			REQUIRED_ERROR
		);
		expect(backend.create).not.toHaveBeenCalled();
	});

	it("disables duplicate submission while saving and shows the confirmed item", async () => {
		const response = Promise.withResolvers<Item>();
		backend.create.mockReturnValue(response.promise);
		const user = userEvent.setup();
		renderPage();
		await screen.findByRole("link");
		await user.click(screen.getByRole("button", { name: action }));
		await user.type(screen.getByLabelText(field), "Created");
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => expect(backend.create).toHaveBeenCalledTimes(1));
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(backend.create).toHaveBeenCalledTimes(1);
		expect(backend.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Created" })
		);
		backend.list.mockReturnValue([item("saved", "Created")]);
		await act(async () => {
			response.resolve(item("saved", "Created"));
			await response.promise;
		});
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(await screen.findByRole("link")).toHaveAttribute(
			"href",
			`${path}/saved`
		);
		expect(screen.getByRole("link")).toHaveTextContent("Created");
	});

	it("preserves failed input, reports the rejection, and allows retry", async () => {
		backend.create.mockRejectedValueOnce(
			new TRPCError({ code: "FORBIDDEN", message: "Creation rejected" })
		);
		const user = userEvent.setup();
		renderPage();
		await screen.findByRole("link");
		await user.click(screen.getByRole("button", { name: action }));
		await user.type(screen.getByLabelText(field), "Retried");
		await user.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText("Creation rejected")).toBeVisible();
		const dialog = screen.getByRole("dialog", { name: action });
		expect(within(dialog).getByLabelText(field)).toHaveValue("Retried");
		await waitFor(() =>
			expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled()
		);
		await user.click(within(dialog).getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(await screen.findByRole("link")).toHaveAttribute(
			"href",
			`${path}/saved`
		);
		expect(backend.create).toHaveBeenCalledTimes(2);
	});

	it("retries a failed initial list without showing an empty account", async () => {
		backend.list.mockRejectedValueOnce(
			new TRPCError({ code: "INTERNAL_SERVER_ERROR" })
		);
		const user = userEvent.setup();
		renderPage();
		expect(await screen.findByText(failure, { exact: false })).toBeVisible();
		expect(screen.queryByText(empty)).not.toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Retry", exact: true })
		);
		expect(await screen.findByRole("link")).toHaveAttribute(
			"href",
			`${path}/existing`
		);
	});

	it("toggles a favorite and rolls back a rejected second toggle", async () => {
		const user = userEvent.setup();
		renderPage();
		await user.click(
			await screen.findByRole("button", { name: "Add to favorites" })
		);
		await waitFor(() =>
			expect(backend.toggle).toHaveBeenCalledWith({ id: "existing" })
		);
		await waitFor(() => expect(queryClient.isMutating()).toBe(0));
		backend.toggle.mockRejectedValueOnce(
			new TRPCError({ code: "FORBIDDEN", message: "Favorite rejected" })
		);
		await user.click(
			screen.getByRole("button", { name: "Remove from favorites" })
		);
		expect(await screen.findByText("Favorite rejected")).toBeVisible();
		expect(
			await screen.findByRole("button", { name: "Remove from favorites" })
		).toBeEnabled();
		expect(backend.toggle).toHaveBeenCalledTimes(2);
		expect(backend.toggle).toHaveBeenNthCalledWith(2, { id: "existing" });
	});
});
