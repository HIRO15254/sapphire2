import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { TournamentModalContent } from "../tournament-modal-content";

const hoisted = vi.hoisted(() => ({
	useTournamentModalContent: vi.fn(),
}));

vi.mock("../use-tournament-modal-content", () => ({
	useTournamentModalContent: hoisted.useTournamentModalContent,
}));

vi.mock(
	"@/features/rooms/components/tournament-modal-content/tournament-form",
	() => ({
		TournamentForm: ({
			formId,
			onInvalidSubmit,
			onSubmit,
			onVariantChange,
		}: {
			formId: string;
			onInvalidSubmit?: () => void;
			onSubmit: (values: unknown) => void;
			onVariantChange?: (variant: string) => void;
		}) => (
			<div data-form-id={formId} data-testid="tournament-form">
				<button onClick={() => onInvalidSubmit?.()} type="button">
					trigger-invalid
				</button>
				<button onClick={() => onSubmit({ name: "Sunday" })} type="button">
					trigger-submit
				</button>
				<button onClick={() => onVariantChange?.("8-Game")} type="button">
					trigger-variant
				</button>
			</div>
		),
	})
);

vi.mock("@/features/rooms/components/blind-level-editor", () => ({
	LocalBlindStructureContent: ({
		onChange,
		value,
		variant,
	}: {
		onChange: (levels: BlindLevelRow[]) => void;
		value: BlindLevelRow[];
		variant?: string;
	}) => (
		<div
			data-count={value.length}
			data-testid="blind-structure"
			data-variant={variant}
		>
			<button onClick={() => onChange([])} type="button">
				trigger-levels
			</button>
		</div>
	),
}));

const AI_BUTTON_RE = /Auto-fill with AI/;

const level: BlindLevelRow = {
	id: "l1",
	tournamentId: "t1",
	level: 1,
	isBreak: false,
	blind1: 100,
	blind2: 200,
	blind3: null,
	ante: null,
	minutes: 20,
	games: null,
};

interface HookState {
	activeTab: "details" | "structure";
	handleStructureVariantChange: ReturnType<typeof vi.fn>;
	localBlindLevels: BlindLevelRow[];
	setActiveTab: ReturnType<typeof vi.fn>;
	setLocalBlindLevels: ReturnType<typeof vi.fn>;
	structureVariant: string;
}

function setHook(overrides: Partial<HookState> = {}): HookState {
	const state: HookState = {
		localBlindLevels: [level],
		setLocalBlindLevels: vi.fn(),
		activeTab: "details",
		setActiveTab: vi.fn(),
		structureVariant: "NL Hold'em",
		handleStructureVariantChange: vi.fn(),
		...overrides,
	};
	hoisted.useTournamentModalContent.mockReturnValue(state);
	return state;
}

function renderContent(props: Record<string, unknown> = {}) {
	return render(
		<TournamentModalContent
			formId="tournament-test-form"
			initialBlindLevels={[]}
			onSave={vi.fn()}
			{...props}
		/>
	);
}

describe("TournamentModalContent", () => {
	beforeEach(() => {
		hoisted.useTournamentModalContent.mockReset();
	});

	it("renders the AI auto-fill button only when onOpenAi is provided", async () => {
		const user = userEvent.setup();
		setHook();
		const { rerender } = renderContent({ onOpenAi: undefined });
		expect(
			screen.queryByRole("button", { name: AI_BUTTON_RE })
		).not.toBeInTheDocument();

		const onOpenAi = vi.fn();
		rerender(
			<TournamentModalContent
				formId="tournament-test-form"
				initialBlindLevels={[]}
				onOpenAi={onOpenAi}
				onSave={vi.fn()}
			/>
		);
		await user.click(screen.getByRole("button", { name: AI_BUTTON_RE }));
		expect(onOpenAi).toHaveBeenCalledTimes(1);
	});

	it("feeds the form id to TournamentForm and the local levels and variant to the structure editor", () => {
		setHook({ activeTab: "structure", structureVariant: "8-Game" });
		renderContent({ formId: "tournament-edit-form" });
		expect(screen.getByTestId("tournament-form")).toHaveAttribute(
			"data-form-id",
			"tournament-edit-form"
		);
		const structure = screen.getByTestId("blind-structure");
		expect(structure).toHaveAttribute("data-count", "1");
		expect(structure).toHaveAttribute("data-variant", "8-Game");
	});

	it("keeps the tournament form mounted but inactive while the Structure tab is active", () => {
		setHook({ activeTab: "structure" });
		renderContent();
		expect(screen.getByRole("tab", { name: "Structure" })).toHaveAttribute(
			"data-state",
			"active"
		);
		expect(screen.getByTestId("blind-structure")).toBeInTheDocument();
		expect(
			screen
				.getByTestId("tournament-form")
				.closest("[data-slot='tabs-content']")
		).toHaveAttribute("data-state", "inactive");
	});

	it.each([
		["tab", "Structure", "setActiveTab", ["structure"], "details"],
		["button", "trigger-invalid", "setActiveTab", ["details"], "structure"],
		[
			"button",
			"trigger-variant",
			"handleStructureVariantChange",
			["8-Game"],
			"details",
		],
		["button", "trigger-levels", "setLocalBlindLevels", [[]], "structure"],
	] as const)("routes the %s %s to %s", async (role, name, handler, args, activeTab) => {
		const state = setHook({ activeTab });
		renderContent();
		const target = screen.getByRole(role, { name });
		if (role === "tab") {
			fireEvent.mouseDown(target, { button: 0 });
		} else {
			await userEvent.setup().click(target);
		}
		expect(state[handler]).toHaveBeenCalledTimes(1);
		expect(state[handler]).toHaveBeenCalledWith(...args);
	});

	it("saves the form values together with the hook's local blind levels", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		setHook();
		renderContent({ onSave });
		await user.click(screen.getByRole("button", { name: "trigger-submit" }));
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith({ name: "Sunday" }, [level]);
	});
});
