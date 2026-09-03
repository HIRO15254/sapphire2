import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TournamentFormSheet } from "./tournament-form-sheet";

const hoisted = vi.hoisted(() => ({
	useTournamentFormSheet: vi.fn(),
}));

vi.mock("./use-tournament-form-sheet", () => ({
	useTournamentFormSheet: hoisted.useTournamentFormSheet,
}));

vi.mock("@/features/rooms/components/tournament-modal-content", () => ({
	TournamentModalContent: ({
		onOpenAi,
		onRegisterLiveValues,
	}: {
		onOpenAi?: () => void;
		onRegisterLiveValues?: (getter: () => unknown) => void;
	}) => (
		<div
			data-live-values={String(onRegisterLiveValues !== undefined)}
			data-testid="modal-content"
		>
			<button
				disabled={onOpenAi === undefined}
				onClick={onOpenAi}
				type="button"
			>
				content-open-ai
			</button>
		</div>
	),
}));

vi.mock(
	"@/features/rooms/components/tournament-form-sheet/ai-extract-input",
	() => ({
		AiExtractInput: ({
			onExtracted,
		}: {
			onExtracted: (data: unknown) => void;
		}) => (
			<button
				data-testid="ai-extract"
				onClick={() => onExtracted({ name: "Extracted" })}
				type="button"
			>
				ai-extracted
			</button>
		),
	})
);

vi.mock("@/shared/components/form-sheet", () => ({
	FormSheet: ({
		children,
		isSaveDisabled,
		open,
		title,
	}: {
		children: React.ReactNode;
		isSaveDisabled?: boolean;
		open: boolean;
		title: string;
	}) =>
		open ? (
			<div data-sheet={title}>
				<button aria-label="Save" disabled={isSaveDisabled} type="button">
					Save
				</button>
				{children}
			</div>
		) : null,
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
	const hook = {
		aiSheetOpen: false,
		setAiSheetOpen: vi.fn(),
		aiKey: 0,
		effectiveFormValues: undefined,
		effectiveLevels: [],
		contentKey: "tournament-0",
		handleAiExtracted: vi.fn(),
		registerLiveValues: vi.fn(),
		...overrides,
	};
	hoisted.useTournamentFormSheet.mockReturnValue(hook);
	return hook;
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
		hoisted.useTournamentFormSheet.mockReset();
		setHook();
	});

	it("mounts the AI drawer and the content's AI hooks only when aiMode is set", () => {
		const { unmount } = renderSheet({ aiMode: undefined });
		expect(screen.queryByTestId("ai-drawer")).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "content-open-ai" })
		).toBeDisabled();
		expect(screen.getByTestId("modal-content")).toHaveAttribute(
			"data-live-values",
			"false"
		);
		unmount();

		renderSheet({ aiMode: "create" });
		expect(screen.getByTestId("ai-drawer")).toBeInTheDocument();
		expect(screen.getByTestId("ai-extract")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "content-open-ai" })
		).toBeEnabled();
		expect(screen.getByTestId("modal-content")).toHaveAttribute(
			"data-live-values",
			"true"
		);
	});

	it.each([
		["content-open-ai", "setAiSheetOpen", [true]],
		["ai-extracted", "handleAiExtracted", [{ name: "Extracted" }]],
	] as const)("routes %s to %s", (name, handler, args) => {
		const hook = setHook();
		renderSheet({ aiMode: "create" });
		fireEvent.click(screen.getByRole("button", { name }));
		expect(hook[handler]).toHaveBeenCalledTimes(1);
		expect(hook[handler]).toHaveBeenCalledWith(...args);
	});

	it("shows blind-level load errors without rendering the form and disables Save", () => {
		const onRetry = vi.fn();
		renderSheet({
			editBlindLevelsError: true,
			onRetryBlindLevels: onRetry,
		});

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load blind levels"
		);
		expect(screen.queryByTestId("modal-content")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it.each([
		[true, 0, "the loading placeholder"],
		[false, 0, "the modal content"],
		[true, 1, "the modal content"],
	])("with isInitializing=%s and aiKey=%s shows %s", (isInitializing, aiKey, expected) => {
		setHook({ aiKey });
		renderSheet({ isInitializing });
		const loading = expected === "the loading placeholder";
		expect(screen.queryByText("Loading...") !== null).toBe(loading);
		expect(screen.queryByTestId("modal-content") !== null).toBe(!loading);
	});
});
