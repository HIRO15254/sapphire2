import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
		TournamentForm: ({ formId }: { formId: string }) => (
			<div data-form-id={formId} data-testid="tournament-form" />
		),
	})
);

vi.mock("@/features/rooms/components/blind-level-editor", () => ({
	LocalBlindStructureContent: () => <div data-testid="blind-structure" />,
}));

const AI_BUTTON_RE = /Auto-fill with AI/;

beforeEach(() => {
	hoisted.useTournamentModalContent.mockReturnValue({
		localBlindLevels: [],
		setLocalBlindLevels: vi.fn(),
	});
});

describe("TournamentModalContent", () => {
	it("does not render the AI auto-fill button when onOpenAi is undefined", () => {
		render(
			<TournamentModalContent
				formId="tournament-test-form"
				initialBlindLevels={[]}
				onSave={vi.fn()}
			/>
		);
		expect(
			screen.queryByRole("button", { name: AI_BUTTON_RE })
		).not.toBeInTheDocument();
	});

	it("renders the AI auto-fill button and calls onOpenAi when clicked", async () => {
		const user = userEvent.setup();
		const onOpenAi = vi.fn();
		render(
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

	it("forwards the formId to the embedded TournamentForm", () => {
		render(
			<TournamentModalContent
				formId="tournament-edit-form"
				initialBlindLevels={[]}
				onSave={vi.fn()}
			/>
		);
		expect(screen.getByTestId("tournament-form")).toHaveAttribute(
			"data-form-id",
			"tournament-edit-form"
		);
	});

	it("keeps the tournament form mounted when the Structure tab is active so the external Save button still submits", async () => {
		const user = userEvent.setup();
		render(
			<TournamentModalContent
				formId="tournament-test-form"
				initialBlindLevels={[]}
				onSave={vi.fn()}
			/>
		);
		await user.click(screen.getByRole("tab", { name: "Structure" }));
		// The Structure tab content is now shown...
		expect(screen.getByTestId("blind-structure")).toBeInTheDocument();
		// ...but the Details form must remain in the DOM: the FormSheet Save
		// button submits it via `form={formId}`, which resolves nothing if the
		// form has been unmounted (SA2-97).
		expect(screen.getByTestId("tournament-form")).toBeInTheDocument();
	});
});
