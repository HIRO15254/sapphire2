import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TournamentFormSheet } from "./tournament-form-sheet";

const hoisted = vi.hoisted(() => ({
	useTournamentEditDialog: vi.fn(),
}));

vi.mock("@/features/rooms/components/tournament-edit-dialog", () => ({
	useTournamentEditDialog: hoisted.useTournamentEditDialog,
}));

vi.mock("@/features/rooms/components/tournament-modal-content", () => ({
	TournamentModalContent: () => <div data-testid="modal-content" />,
}));

vi.mock("@/features/rooms/components/ai-extract-input", () => ({
	AiExtractInput: () => <div data-testid="ai-extract" />,
}));

vi.mock("@/shared/components/form-sheet", () => ({
	FormSheet: ({
		children,
		open,
		title,
	}: {
		children: React.ReactNode;
		open: boolean;
		title: string;
	}) => (open ? <div data-sheet={title}>{children}</div> : null),
}));

vi.mock("@/shared/components/ui/drawer", () => ({
	Drawer: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="ai-drawer">{children}</div>
	),
	DrawerContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DrawerTitle: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DrawerDescription: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

function setHook(overrides: Record<string, unknown> = {}) {
	hoisted.useTournamentEditDialog.mockReturnValue({
		aiSheetOpen: false,
		setAiSheetOpen: vi.fn(),
		aiKey: 0,
		effectiveFormValues: undefined,
		effectiveLevels: [],
		contentKey: "tournament-0",
		handleAiExtracted: vi.fn(),
		...overrides,
	});
}

function renderSheet(props: Record<string, unknown> = {}) {
	return render(
		<TournamentFormSheet
			formId="tournament-create-form"
			initialBlindLevels={[]}
			isLoading={false}
			onOpenChange={vi.fn()}
			onSave={vi.fn()}
			open={true}
			title="Add tournament"
			{...props}
		/>
	);
}

describe("TournamentFormSheet", () => {
	beforeEach(() => {
		hoisted.useTournamentEditDialog.mockReset();
		setHook();
	});

	it("does not render the AI drawer when aiMode is undefined", () => {
		renderSheet({ aiMode: undefined });
		expect(screen.queryByTestId("ai-drawer")).not.toBeInTheDocument();
	});

	it("renders the AI drawer when aiMode is set", () => {
		renderSheet({ aiMode: "create" });
		expect(screen.getByTestId("ai-drawer")).toBeInTheDocument();
		expect(screen.getByTestId("ai-extract")).toBeInTheDocument();
	});

	it("shows the loading placeholder while initializing before any AI fill", () => {
		setHook({ aiKey: 0 });
		renderSheet({ isInitializing: true });
		expect(screen.getByText("Loading...")).toBeInTheDocument();
		expect(screen.queryByTestId("modal-content")).not.toBeInTheDocument();
	});

	it("renders the modal content once initialization completes", () => {
		renderSheet({ isInitializing: false });
		expect(screen.getByTestId("modal-content")).toBeInTheDocument();
		expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
	});

	it("renders the modal content while initializing once an AI fill has applied (aiKey > 0)", () => {
		setHook({ aiKey: 1 });
		renderSheet({ isInitializing: true });
		expect(screen.getByTestId("modal-content")).toBeInTheDocument();
		expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
	});
});
