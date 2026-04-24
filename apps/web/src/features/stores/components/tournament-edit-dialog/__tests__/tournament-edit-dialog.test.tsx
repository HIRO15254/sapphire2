import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TournamentEditDialog } from "@/features/stores/components/tournament-edit-dialog/tournament-edit-dialog";

describe("TournamentEditDialog", () => {
	it("displays AI Auto-fill button with English text when aiMode is create", () => {
		render(
			<TournamentEditDialog
				aiMode="create"
				initialBlindLevels={[]}
				isLoading={false}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
				open={true}
				title="Create Tournament"
			/>
		);

		expect(screen.getByText("Auto-fill with AI")).toBeInTheDocument();
	});

	it("displays AI Auto-fill dialog title with English text when open", () => {
		render(
			<TournamentEditDialog
				aiMode="create"
				initialBlindLevels={[]}
				isLoading={false}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
				open={true}
				title="Create Tournament"
			/>
		);

		const dialogs = screen.getAllByText("Auto-fill with AI");
		expect(dialogs.length).toBeGreaterThan(0);
	});
});
