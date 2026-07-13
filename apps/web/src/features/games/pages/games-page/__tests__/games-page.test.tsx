import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	onRetry: vi.fn(),
	useGamesPage: vi.fn(),
}));

vi.mock("../use-games-page", () => ({ useGamesPage: mocks.useGamesPage }));

vi.mock("@/shared/components/page-header", () => ({
	PageHeader: ({ heading }: { heading: string }) => <h1>{heading}</h1>,
}));

vi.mock("../delete-confirm-dialog", () => ({
	DeleteConfirmDialog: () => null,
}));
vi.mock("../group-card", () => ({ GroupCard: () => null }));
vi.mock("../group-form-sheet", () => ({ GroupFormSheet: () => null }));
vi.mock("../mixes-card", () => ({ MixesCard: () => null }));
vi.mock("../variant-form-sheet", () => ({ VariantFormSheet: () => null }));
vi.mock("@/shared/components/mix-form-sheet", () => ({
	MixFormSheet: () => null,
}));

import { GamesPage } from "../games-page";

function gamePageState(overrides: Record<string, unknown> = {}) {
	return {
		groups: [],
		groupOptions: [],
		mixes: [],
		variants: [],
		isLoading: false,
		isError: false,
		onRetry: mocks.onRetry,
		isGroupSheetOpen: false,
		editingGroup: null,
		onAddGroup: vi.fn(),
		onEditGroup: vi.fn(),
		onGroupSheetOpenChange: vi.fn(),
		isVariantSheetOpen: false,
		editingVariant: null,
		createGroupId: null,
		onAddVariant: vi.fn(),
		onEditVariant: vi.fn(),
		onVariantSheetOpenChange: vi.fn(),
		isMixSheetOpen: false,
		editingMix: null,
		onAddMix: vi.fn(),
		onEditMix: vi.fn(),
		onMixSheetOpenChange: vi.fn(),
		deletingGroup: null,
		onDeleteGroupRequest: vi.fn(),
		onDeleteGroupConfirm: vi.fn(),
		onDeleteGroupCancel: vi.fn(),
		isDeleteGroupPending: false,
		deletingVariant: null,
		onDeleteVariantRequest: vi.fn(),
		onDeleteVariantConfirm: vi.fn(),
		onDeleteVariantCancel: vi.fn(),
		isDeleteVariantPending: false,
		deletingMix: null,
		onDeleteMixRequest: vi.fn(),
		onDeleteMixConfirm: vi.fn(),
		onDeleteMixCancel: vi.fn(),
		isDeleteMixPending: false,
		...overrides,
	};
}

describe("GamesPage", () => {
	it("renders its sibling form sheets without duplicate React keys", () => {
		mocks.useGamesPage.mockReturnValue(gamePageState());
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		render(<GamesPage />);

		expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
			"Encountered two children with the same key"
		);
		consoleError.mockRestore();
	});

	it("shows a retryable error instead of empty game-library states when a master list fails", async () => {
		const user = userEvent.setup();
		mocks.onRetry.mockReset();
		mocks.useGamesPage.mockReturnValue(gamePageState({ isError: true }));

		render(<GamesPage />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Failed to load games. Please try again."
		);
		expect(screen.queryByText("No mixes yet.")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Retry" }));
		expect(mocks.onRetry).toHaveBeenCalledTimes(1);
	});
});
