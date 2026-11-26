import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initTRPC, TRPCError } from "@trpc/server";
import { setupServer } from "msw/node";
import { toast } from "sonner";
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
import {
	bigBet,
	gameMix,
	gameVariant,
	limit,
	stud,
} from "@/features/games/__tests__/fixtures";
import { Toaster } from "@/shared/components/ui/sonner";
import { queryClient } from "@/utils/trpc";
import { GamesPage } from "../games-page";

vi.mock("@sapphire2/env/web", () => ({
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));

type Group = typeof limit;
type Variant = ReturnType<typeof gameVariant>;
type Mix = ReturnType<typeof gameMix>;

const DUO_ROW = /Duo/u;
const MIXES_TAB = /Mixes/u;
const NLH_ROW = /NL Hold'em/u;
const PLO_ROW = /Pot Limit Omaha/u;
const RAZZ_ROW = /Razz/u;
const ARCHIVED_AT = "2026-11-20T00:00:00.000Z";

interface ServerState {
	deleteGate: Promise<void> | undefined;
	deletes: string[];
	failGroups: boolean;
	failMixUpdate: boolean;
	groups: Group[];
	mixes: Mix[];
	nextId: number;
	variants: Variant[];
}

const state: ServerState = {
	deleteGate: undefined,
	deletes: [],
	failGroups: false,
	failMixUpdate: false,
	groups: [],
	mixes: [],
	nextId: 0,
	variants: [],
};

function reset() {
	state.deleteGate = undefined;
	state.deletes = [];
	state.failGroups = false;
	state.failMixUpdate = false;
	state.groups = [limit, stud, bigBet].map((group) => ({ ...group }));
	state.variants = [
		gameVariant({
			groupId: "big-bet",
			id: "nlh",
			isReferenced: true,
			label: "NL Hold'em",
			shortLabel: "NLH",
		}),
		gameVariant({
			groupId: "big-bet",
			id: "plo",
			label: "Pot Limit Omaha",
			shortLabel: "PLO",
		}),
		gameVariant({
			groupId: "limit",
			id: "lhe",
			isReferenced: true,
			label: "Limit Hold'em",
			shortLabel: "LHE",
		}),
		gameVariant({
			groupId: "stud",
			id: "razz",
			isReferenced: true,
			label: "Razz",
		}),
	];
	state.mixes = [gameMix({ games: ["lhe", "nlh"], id: "duo", label: "Duo" })];
}

const t = initTRPC.create();
const idInput = z.object({ id: z.string() });

function setArchived<Row extends { archivedAt: string | null; id: string }>(
	rows: Row[],
	id: string,
	archivedAt: string | null
) {
	const row = rows.find((item) => item.id === id);
	if (!row) {
		throw new TRPCError({ code: "FORBIDDEN" });
	}
	row.archivedAt = archivedAt;
	return row;
}

const router = t.router({
	gameGroup: t.router({
		list: t.procedure.input(z.unknown()).query(() => {
			if (state.failGroups) {
				throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
			}
			return state.groups;
		}),
	}),
	gameMix: t.router({
		list: t.procedure.input(z.unknown()).query(() => state.mixes),
		update: t.procedure
			.input(
				z.object({
					games: z.array(z.string()).optional(),
					id: z.string(),
					label: z.string().optional(),
				})
			)
			.mutation(({ input }) => {
				if (state.failMixUpdate) {
					throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
				}
				const mix = state.mixes.find((row) => row.id === input.id);
				if (!mix) {
					throw new TRPCError({ code: "FORBIDDEN" });
				}
				Object.assign(mix, {
					games: input.games ?? mix.games,
					label: input.label ?? mix.label,
				});
				return mix;
			}),
	}),
	gameVariant: t.router({
		archive: t.procedure
			.input(idInput)
			.mutation(({ input }) =>
				setArchived(state.variants, input.id, ARCHIVED_AT)
			),
		create: t.procedure
			.input(
				z.object({
					groupId: z.string(),
					label: z.string(),
					shortLabel: z.string().nullable().optional(),
				})
			)
			.mutation(({ input }) => {
				state.nextId += 1;
				const variant = gameVariant({
					groupId: input.groupId,
					id: `new-${state.nextId}`,
					label: input.label,
					shortLabel: input.shortLabel ?? null,
				});
				state.variants.push(variant);
				return variant;
			}),
		delete: t.procedure.input(idInput).mutation(async ({ input }) => {
			state.deletes.push(input.id);
			await state.deleteGate;
			state.variants = state.variants.filter((row) => row.id !== input.id);
			return { id: input.id };
		}),
		list: t.procedure.input(z.unknown()).query(() => state.variants),
		restore: t.procedure
			.input(idInput)
			.mutation(({ input }) => setArchived(state.variants, input.id, null)),
	}),
});

const server = setupServer(trpcHttpHandler("http://localhost:8787", router));

function renderPage() {
	return renderIntegrationPage(
		<>
			<Toaster />
			<GamesPage />
		</>,
		{ path: "/games", queryClient }
	);
}

async function toastFor(text: string) {
	const item = (await screen.findByText(text)).closest("[data-sonner-toast]");
	if (!(item instanceof HTMLElement)) {
		throw new Error(`No toast for ${text}`);
	}
	return within(item);
}

async function openRow(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
	await user.click(await screen.findByRole("button", { name }));
	return screen.findByRole("dialog");
}

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({
			addEventListener: vi.fn(),
			matches: false,
			removeEventListener: vi.fn(),
		}),
	});
	server.listen({ onUnhandledFrame: "error" });
	queryClient.setDefaultOptions({
		mutations: { networkMode: "always", retry: false },
		queries: { networkMode: "always", retry: false, staleTime: 0 },
	});
});

beforeEach(() => {
	toast.dismiss();
	reset();
	queryClient.clear();
});

afterEach(() => {
	server.resetHandlers();
});

afterAll(() => {
	server.close();
});

describe("GamesPage", () => {
	it("lists games when structures fail and regroups them after Retry", async () => {
		state.failGroups = true;
		const user = userEvent.setup();
		renderPage();

		const alert = within(
			(await screen.findByText("Structures didn't load")).closest(
				"[data-slot=alert]"
			) as HTMLElement
		);
		const all = screen.getByRole("region", { name: "All games" });
		expect(within(all).getByText("Pot Limit Omaha")).toBeInTheDocument();

		state.failGroups = false;
		await user.click(alert.getByRole("button", { name: "Retry" }));

		const section = await screen.findByRole("region", { name: "Big Bet" });
		expect(within(section).getByText("Pot Limit Omaha")).toBeInTheDocument();
		expect(screen.queryByRole("region", { name: "All games" })).toBeNull();
	});

	it("validates a new game, saves it and deletes it again on Undo", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByText("Pot Limit Omaha");

		await user.click(screen.getByRole("button", { name: "New game" }));
		const sheet = await screen.findByRole("dialog", { name: "New game" });
		await user.click(within(sheet).getByRole("button", { name: "Create" }));

		expect(await within(sheet).findByText("Enter a name")).toBeInTheDocument();

		await user.type(within(sheet).getByLabelText("Name *"), "Badugi");
		await user.click(within(sheet).getByRole("combobox"));
		await user.click(await screen.findByRole("option", { name: "Limit" }));
		await user.click(within(sheet).getByRole("button", { name: "Create" }));

		const limitSection = await screen.findByRole("region", { name: "Limit" });
		expect(await within(limitSection).findByText("Badugi")).toBeInTheDocument();
		expect(state.variants.map((row) => row.label)).toContain("Badugi");

		const added = await toastFor("Game added");
		await user.click(added.getByRole("button", { name: "Undo" }));

		await waitFor(() => expect(state.deletes).toEqual(["new-1"]));
		await waitFor(() => expect(screen.queryByText("Badugi")).toBeNull());
	});

	it("keeps an edited mix in the sheet when saving fails and saves it on retry", async () => {
		state.failMixUpdate = true;
		const user = userEvent.setup();
		renderPage();
		await screen.findByText("Pot Limit Omaha");

		await user.click(screen.getByRole("tab", { name: MIXES_TAB }));
		const menu = await openRow(user, DUO_ROW);
		await user.click(within(menu).getByRole("button", { name: "Edit" }));
		const sheet = await screen.findByRole("dialog", { name: "Edit mix" });
		const name = within(sheet).getByLabelText("Name *");
		await user.clear(name);
		await user.type(name, "Trio");
		await user.click(
			within(sheet).getByRole("button", { name: "Choose games" })
		);
		const picker = await screen.findByRole("dialog", { name: "Games" });
		await user.click(
			within(picker).getByRole("checkbox", { name: "Pot Limit Omaha" })
		);
		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Games" })).toBeNull()
		);

		await user.click(within(sheet).getByRole("button", { name: "Save" }));

		expect(
			await screen.findByText("Couldn't save changes")
		).toBeInTheDocument();
		expect(within(sheet).getByLabelText("Name *")).toHaveValue("Trio");
		expect(within(sheet).getByText("PLO")).toBeInTheDocument();

		state.failMixUpdate = false;
		await user.click(within(sheet).getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Edit mix" })).toBeNull()
		);
		expect(state.mixes[0]).toMatchObject({
			games: ["lhe", "nlh", "plo"],
			label: "Trio",
		});
	});

	it("deletes an unused game only after confirming, without Undo", async () => {
		const gate = Promise.withResolvers<void>();
		state.deleteGate = gate.promise;
		const user = userEvent.setup();
		renderPage();

		let menu = await openRow(user, PLO_ROW);
		await user.click(within(menu).getByRole("button", { name: "Delete" }));
		let dialog = await screen.findByRole("dialog", {
			name: "Delete Pot Limit Omaha?",
		});
		await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(state.deletes).toEqual([]);

		menu = await openRow(user, PLO_ROW);
		await user.click(within(menu).getByRole("button", { name: "Delete" }));
		dialog = await screen.findByRole("dialog", {
			name: "Delete Pot Limit Omaha?",
		});
		const confirm = within(dialog).getByRole("button", { name: "Delete" });
		await user.click(confirm);

		await waitFor(() => expect(confirm).toBeDisabled());
		expect(state.deletes).toEqual(["plo"]);
		gate.resolve();

		const deleted = await toastFor("Game deleted");
		expect(deleted.queryByRole("button", { name: "Undo" })).toBeNull();
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: PLO_ROW })).toBeNull()
		);
	});

	it("offers to archive a game in use instead of deleting it, and Undo restores it", async () => {
		const user = userEvent.setup();
		renderPage();

		const menu = await openRow(user, RAZZ_ROW);
		await user.click(within(menu).getByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog", {
			name: "Razz is in use",
		});
		await user.click(
			within(dialog).getByRole("button", { name: "Archive instead" })
		);

		const archivedToast = await toastFor("Game archived");
		await waitFor(() =>
			expect(state.variants.find((row) => row.id === "razz")?.archivedAt).toBe(
				ARCHIVED_AT
			)
		);
		expect(state.deletes).toEqual([]);
		const archived = await screen.findByRole("region", { name: "Archived" });
		expect(within(archived).getByText("Razz")).toBeInTheDocument();

		await user.click(archivedToast.getByRole("button", { name: "Undo" }));

		await waitFor(() =>
			expect(
				state.variants.find((row) => row.id === "razz")?.archivedAt
			).toBeNull()
		);
	});

	it("does not offer archiving for a game an active mix still uses", async () => {
		const user = userEvent.setup();
		renderPage();

		const menu = await openRow(user, NLH_ROW);
		expect(
			within(menu).getByRole("button", { name: "Archive" })
		).toBeDisabled();
		expect(within(menu).getByText("Used by Duo.")).toBeInTheDocument();
		await user.click(within(menu).getByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog", {
			name: "NL Hold'em is in use",
		});

		expect(
			within(dialog).getByText("It can’t be deleted. Used by Duo.")
		).toBeInTheDocument();
		expect(
			within(dialog).queryByRole("button", { name: "Archive instead" })
		).toBeNull();
	});
});
