import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TournamentModalContent } from "../tournament-modal-content";

// The real (trivial, useState-only) useTournamentModalContent hook is used so
// the controlled-tab behavior (activeTab / setActiveTab) is exercised end to end.
vi.mock(
	"@/features/rooms/components/tournament-modal-content/tournament-form",
	() => ({
		TournamentForm: ({
			formId,
			onInvalidSubmit,
		}: {
			formId: string;
			onInvalidSubmit?: () => void;
		}) => (
			<div data-form-id={formId} data-testid="tournament-form">
				<button onClick={() => onInvalidSubmit?.()} type="button">
					trigger-invalid
				</button>
			</div>
		),
	})
);

vi.mock("@/features/rooms/components/blind-level-editor", () => ({
	LocalBlindStructureContent: () => <div data-testid="blind-structure" />,
}));

const AI_BUTTON_RE = /Auto-fill with AI/;

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
		const form = screen.getByTestId("tournament-form");
		expect(form).toBeInTheDocument();
		// forceMount renders inactive content without the `hidden` attr, so it is
		// hidden via `data-[state=inactive]:hidden` — assert the panel carries the
		// inactive state that drives that class (regression guard for the fix).
		expect(form.closest("[data-slot='tabs-content']")).toHaveAttribute(
			"data-state",
			"inactive"
		);
	});

	it("switches back to the Details tab when a submit fails validation so the user sees the error", async () => {
		const user = userEvent.setup();
		render(
			<TournamentModalContent
				formId="tournament-test-form"
				initialBlindLevels={[]}
				onSave={vi.fn()}
			/>
		);
		await user.click(screen.getByRole("tab", { name: "Structure" }));
		expect(screen.getByRole("tab", { name: "Structure" })).toHaveAttribute(
			"data-state",
			"active"
		);
		// The form reports an invalid submit (e.g. empty required name) while the
		// Structure tab is open; the sheet must reveal the erroring Details tab
		// instead of silently swallowing the click (SA2-97 follow-up).
		await user.click(screen.getByRole("button", { name: "trigger-invalid" }));
		expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute(
			"data-state",
			"active"
		);
	});
});
