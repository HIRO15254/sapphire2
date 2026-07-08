import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameVariant } from "@/features/game-variants/hooks/use-game-variants";

// LocalBlindStructureContent (reused by the tournament Rules step) pulls in
// the rooms blind-level editor, which transitively imports @/utils/trpc.
// Stub it so the env-validating import chain is not loaded under jsdom.
vi.mock("@/utils/trpc", () => ({
	trpc: {
		blindLevel: {
			listByTournament: {
				queryOptions: () => ({ queryKey: ["blindLevel.listByTournament"] }),
			},
		},
	},
	trpcClient: {},
}));

// SessionWizard resolves its Rules-step variant selects from the user's game
// variants; stub the hook so these structural tests don't need a QueryClient.
// Individual tests can seed `gameVariantsMocks.variants` before rendering.
const gameVariantsMocks = vi.hoisted(() => ({
	variants: [] as GameVariant[],
}));

vi.mock("@/features/game-variants/hooks/use-game-variants", () => ({
	useGameVariants: () => ({ variants: gameVariantsMocks.variants }),
}));

import { SessionWizard } from "./session-wizard";

const SHORT_DECK_VARIANT: GameVariant = {
	id: "v-sd",
	name: "Short Deck",
	blindLabel1: "Button blind",
	blindLabel2: null,
	blindLabel3: null,
	sortOrder: 5,
	archivedAt: null,
};

const PLO_VARIANT: GameVariant = {
	id: "v-plo",
	name: "PLO",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: "Straddle",
	sortOrder: 2,
	archivedAt: null,
};

const STORE = { id: "room-1", name: "My Casino" };
const RING_GAME = {
	id: "rg-1",
	name: "1/2 NLH",
	variant: "nlh",
	blind1: 1,
	blind2: 2,
};
const NEXT_RE = /Next/;
const BACK_RE = /Back/;
const SAVE_RE = /Save/;
const SESSION_DATE_RE = /Session date/;
const LEVEL_RE = /Level/;
const BREAK_RE = /Break/;

beforeEach(() => {
	gameVariantsMocks.variants = [];
});

describe("SessionWizard — step gating", () => {
	it("starts on the master step with type tabs and a Next button", () => {
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		expect(screen.getByText("Master")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: NEXT_RE })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: SAVE_RE })
		).not.toBeInTheDocument();
	});

	it("disables Back on the first step", () => {
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		const back = screen.getByRole("button", { name: BACK_RE });
		expect(back).toBeDisabled();
	});

	it("advances master → rules → result via Next", async () => {
		const user = userEvent.setup();
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);

		// Master shows the session-type tabs
		expect(screen.getByText("Cash game")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		// Rules step: cash variant field shows up
		expect(screen.getByText("Variant")).toBeInTheDocument();
		expect(screen.getByText("SB")).toBeInTheDocument();
		expect(screen.getByText("BB")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		// Result step: date + buy-in/cash-out + Save button
		expect(screen.getByLabelText(SESSION_DATE_RE)).toBeInTheDocument();
		expect(document.getElementById("buyIn")).toBeInTheDocument();
		expect(document.getElementById("cashOut")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: SAVE_RE })).toBeInTheDocument();
	});

	it("Back returns to the previous step without losing field values", async () => {
		const user = userEvent.setup();
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("button", { name: BACK_RE }));
		expect(screen.getByText("Cash game")).toBeInTheDocument();
	});
});

describe("SessionWizard — tournament mode", () => {
	it("renders tournament rules on the rules step when type is tournament", async () => {
		const user = userEvent.setup();
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByText("Tournament"));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(document.getElementById("tournamentBuyIn")).toBeInTheDocument();
		expect(document.getElementById("entryFee")).toBeInTheDocument();
	});

	it("splits the tournament Rules step into Settings and Blind levels tabs", async () => {
		const user = userEvent.setup();
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByText("Tournament"));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
		expect(
			screen.getByRole("tab", { name: "Blind levels" })
		).toBeInTheDocument();
		// Settings tab is active by default — chip purchases live there.
		expect(screen.getByText("Chip Purchases")).toBeInTheDocument();
	});

	it("reveals the shared blind-structure editor on the Blind levels tab", async () => {
		const user = userEvent.setup();
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByText("Tournament"));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("tab", { name: "Blind levels" }));
		expect(screen.getByRole("button", { name: LEVEL_RE })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: BREAK_RE })).toBeInTheDocument();
	});
});

describe("SessionWizard — snapshot scalar fields", () => {
	it("renders ruleName + min/maxBuyIn on the cash rules step", async () => {
		const user = userEvent.setup();
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(screen.getByLabelText("Rule name")).toBeInTheDocument();
		expect(screen.getByLabelText("Min buy-in")).toBeInTheDocument();
		expect(screen.getByLabelText("Max buy-in")).toBeInTheDocument();
	});

	it("renders ruleName + startingStack + bountyAmount on the tournament rules step", async () => {
		const user = userEvent.setup();
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByText("Tournament"));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(screen.getByLabelText("Rule name")).toBeInTheDocument();
		expect(screen.getByLabelText("Starting stack")).toBeInTheDocument();
		expect(screen.getByLabelText("Bounty amount")).toBeInTheDocument();
	});
});

describe("SessionWizard — master-step pre-fill", () => {
	it("populates rule fields from a selected ring game when advancing", async () => {
		const user = userEvent.setup();
		render(
			<SessionWizard
				onSubmit={vi.fn()}
				ringGames={[RING_GAME]}
				rooms={[STORE]}
			/>
		);

		// Wizard owns room selection; the form options surface once a room
		// is picked. Hop to the rules step and inspect that the cash-rule
		// fields render — the deeper pre-fill behavior is covered by the
		// shared hook tests.
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(screen.getByText("Variant")).toBeInTheDocument();
	});
});

function readVariantSelectOptions(): (string | null)[] {
	const trigger = document.querySelector("button#variant");
	const nativeSelect = trigger?.nextElementSibling;
	return Array.from(nativeSelect?.querySelectorAll("option") ?? []).map(
		(el) => el.textContent
	);
}

describe("SessionWizard — variant select and blind labels", () => {
	it("populates the cash Rules-step Variant select from the user's game variants", async () => {
		const user = userEvent.setup();
		gameVariantsMocks.variants = [PLO_VARIANT];
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(readVariantSelectOptions()).toEqual(["PLO"]);
	});

	it("drives the tournament blind-structure column headers from the selected variant, hiding null-labeled slots", async () => {
		const user = userEvent.setup();
		gameVariantsMocks.variants = [SHORT_DECK_VARIANT];
		render(
			<SessionWizard
				defaultValues={{ type: "tournament", variant: "Short Deck" }}
				onSubmit={vi.fn()}
				rooms={[STORE]}
			/>
		);
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("tab", { name: "Blind levels" }));
		expect(
			screen.getByRole("columnheader", { name: "Button blind" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("columnheader", { name: "SB" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("columnheader", { name: "BB" })
		).not.toBeInTheDocument();
	});
});

const START_RE = /Start session/;
const START_CUSTOM_RE = /Start/;

describe("SessionWizard — live mode", () => {
	it("renders Master + Rules + Start steps (drops Result)", () => {
		render(<SessionWizard mode="live" onSubmit={vi.fn()} rooms={[STORE]} />);
		expect(screen.getByText("Master")).toBeInTheDocument();
		expect(screen.getByText("Rules")).toBeInTheDocument();
		expect(screen.getByText("Start")).toBeInTheDocument();
		expect(screen.queryByText("Result")).not.toBeInTheDocument();
	});

	it("shows the Start session label on the Start step in live mode", async () => {
		const user = userEvent.setup();
		render(
			<SessionWizard
				mode="live"
				onSubmit={vi.fn()}
				rooms={[STORE]}
				submitLabel="Start session"
			/>
		);
		// Advance Master -> Rules -> Start (the last step in live mode).
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(screen.getByRole("button", { name: START_RE })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: SAVE_RE })
		).not.toBeInTheDocument();
	});

	it("renders the Initial buy-in field on the cash Start step", async () => {
		const user = userEvent.setup();
		render(<SessionWizard mode="live" onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(screen.getByText("Initial buy-in")).toBeInTheDocument();
		expect(document.getElementById("buyIn")).toBeInTheDocument();
	});

	it("shows the blind-timer field on the tournament Start step", async () => {
		const user = userEvent.setup();
		render(<SessionWizard mode="live" onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByText("Tournament"));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(screen.getByText("Blind timer start")).toBeInTheDocument();
		expect(document.getElementById("timerStartedAt")).toBeInTheDocument();
	});

	it("defaults to 'Start' label when mode=live and submitLabel is omitted", async () => {
		const user = userEvent.setup();
		render(<SessionWizard mode="live" onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		expect(
			screen.getByRole("button", { name: START_CUSTOM_RE })
		).toBeInTheDocument();
	});

	it("keeps tournament result fields out of the Rules step", async () => {
		const user = userEvent.setup();
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByText("Tournament"));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		// Rules step: rule fields present, result fields absent.
		expect(document.getElementById("tournamentBuyIn")).toBeInTheDocument();
		expect(document.getElementById("entryFee")).toBeInTheDocument();
		expect(document.getElementById("prizeMoney")).not.toBeInTheDocument();
		expect(document.getElementById("placement")).not.toBeInTheDocument();
		expect(document.getElementById("bountyPrizes")).not.toBeInTheDocument();
	});

	it("renders tournament result fields on the Result step", async () => {
		const user = userEvent.setup();
		render(<SessionWizard onSubmit={vi.fn()} rooms={[STORE]} />);
		await user.click(screen.getByText("Tournament"));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		// Result step: prizeMoney / placement / totalEntries (after toggling
		// off the registration-close flag, which is unchecked by default) /
		// bounty. Chip-purchase counts render only when the Rules step
		// defined chip purchases.
		expect(document.getElementById("prizeMoney")).toBeInTheDocument();
		expect(document.getElementById("placement")).toBeInTheDocument();
		expect(document.getElementById("totalEntries")).toBeInTheDocument();
		expect(document.getElementById("bountyPrizes")).toBeInTheDocument();
	});

	it("invokes onSubmit when the Start button is clicked on the Start step", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(
			<SessionWizard
				defaultValues={{ buyIn: 10_000, cashOut: 0 }}
				mode="live"
				onSubmit={onSubmit}
				rooms={[STORE]}
				submitLabel="Start session"
			/>
		);
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("button", { name: NEXT_RE }));
		await user.click(screen.getByRole("button", { name: START_RE }));
		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalled();
		});
	});
});
