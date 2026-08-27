import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const UPLOAD_HINT_PATTERN = /^Upload a screenshot from/;
const DETECTED_ONE_SEAT_PATTERN = /^Detected 1 seat\./;
const APPLY_ONE_PATTERN = /^Apply \(1\)$/;

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const mocks = vi.hoisted(() => ({
	playerList: vi.fn(),
	extractMutateFn: vi.fn(),
	addExisting: vi.fn(),
	addNew: vi.fn(),
	updateHeroCash: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	bottomSheetProps: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("player", "list", input),
					queryFn: () => mocks.playerList(input),
				}),
			},
		},
		aiExtract: {
			extractTablePlayers: {
				mutationOptions: () => ({
					mutationFn: (input: unknown) => mocks.extractMutateFn(input),
				}),
			},
		},
		sessionTablePlayer: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionTablePlayer", "list", input),
				}),
			},
		},
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
		},
	},
	trpcClient: {
		sessionTablePlayer: {
			add: { mutate: mocks.addExisting },
			addNew: { mutate: mocks.addNew },
		},
		liveCashGameSession: {
			updateHeroSeat: { mutate: mocks.updateHeroCash },
		},
		liveTournamentSession: {
			updateHeroSeat: { mutate: vi.fn() },
		},
	},
}));

vi.mock("sonner", () => ({
	toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/shared/components/bottom-sheet", () => ({
	BottomSheet: (props: {
		cancelLabel?: string;
		children: ReactNode;
		contentClassName?: string;
		onCancel?: () => void;
		onOpenChange: (open: boolean) => void;
		open: boolean;
		title: string;
	}) => {
		mocks.bottomSheetProps(props);
		const { cancelLabel, children, onCancel, onOpenChange, open, title } =
			props;
		return open ? (
			<div>
				<h2>{title}</h2>
				<button
					data-testid="chrome-cancel"
					onClick={onCancel ?? (() => onOpenChange(false))}
					type="button"
				>
					{cancelLabel}
				</button>
				{children}
			</div>
		) : null;
	},
}));

import { SeatFromScreenshotSheet } from "@/features/live-sessions/components/seat-from-screenshot-sheet/seat-from-screenshot-sheet";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
}

function renderSheet(onOpenChange = vi.fn()) {
	const client = createClient();
	function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	}
	const result = render(
		<SeatFromScreenshotSheet
			heroSeatPosition={null}
			occupiedSeatPositions={new Set<number>()}
			onOpenChange={onOpenChange}
			open
			sessionParam={{ liveCashGameSessionId: "session-1" }}
			tableSize={9}
		/>,
		{ wrapper: Wrapper }
	);
	return { ...result, onOpenChange };
}

describe("SeatFromScreenshotSheet", () => {
	beforeEach(() => {
		for (const m of Object.values(mocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("passes the fixed title, cancel label, and full-height content class to BottomSheet", () => {
		renderSheet();
		expect(mocks.bottomSheetProps).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Seat from screenshot",
				cancelLabel: "Cancel",
				contentClassName: "h-[calc(100svh-2rem)]",
				open: true,
			})
		);
	});

	it("does not receive a sheetClassName-only content override, keeping the shell-supplied scope", () => {
		renderSheet();
		const [props] = mocks.bottomSheetProps.mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(props.contentClassName).toBe("h-[calc(100svh-2rem)]");
	});

	it("closes via the sheet chrome cancel button when no step-specific handler runs", async () => {
		const user = userEvent.setup();
		const { onOpenChange } = renderSheet();

		await user.click(screen.getByTestId("chrome-cancel"));

		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("advances from the source app picker to the upload step and back", async () => {
		const user = userEvent.setup();
		renderSheet();

		expect(
			screen.getByRole("button", { name: "DMM Waitinglist" })
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "DMM Waitinglist" }));

		expect(
			screen.getByRole("button", { name: "Choose screenshot" })
		).toBeInTheDocument();
		expect(screen.getByText(UPLOAD_HINT_PATTERN)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Back" }));

		expect(
			screen.getByRole("button", { name: "DMM Waitinglist" })
		).toBeInTheDocument();
	});

	it("closes from the empty-review step's Close action when no seats are detected", async () => {
		mocks.extractMutateFn.mockResolvedValue({ seats: [] });
		const user = userEvent.setup();
		const { container, onOpenChange } = renderSheet();

		await user.click(screen.getByRole("button", { name: "DMM Waitinglist" }));
		const fileInput = container.querySelector('input[type="file"]');
		if (!fileInput) {
			throw new Error("file input not found");
		}
		const file = new File(["fake-bytes"], "empty.png", {
			type: "image/png",
		});
		fireEvent.change(fileInput, { target: { files: [file] } });

		await screen.findByText("No players detected in the screenshot.");

		await user.click(screen.getByRole("button", { name: "Close" }));

		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});

	it("reviews an extracted seat and applies it as a new player", async () => {
		mocks.extractMutateFn.mockResolvedValue({
			seats: [{ seatNumber: 3, name: "Alice", isHero: false }],
		});
		mocks.playerList.mockResolvedValue([]);
		const user = userEvent.setup();
		const { container, onOpenChange } = renderSheet();

		await user.click(screen.getByRole("button", { name: "DMM Waitinglist" }));
		const fileInput = container.querySelector('input[type="file"]');
		if (!fileInput) {
			throw new Error("file input not found");
		}
		const file = new File(["fake-bytes"], "table.png", {
			type: "image/png",
		});
		fireEvent.change(fileInput, { target: { files: [file] } });

		await screen.findByText(DETECTED_ONE_SEAT_PATTERN);
		expect(screen.getByRole("combobox")).toHaveValue("Alice");

		await user.click(screen.getByRole("button", { name: APPLY_ONE_PATTERN }));

		await waitFor(() => {
			expect(mocks.addNew).toHaveBeenCalledTimes(1);
		});
		expect(mocks.addNew).toHaveBeenNthCalledWith(1, {
			liveCashGameSessionId: "session-1",
			playerName: "Alice",
			seatPosition: 2,
		});
		expect(mocks.toastSuccess).toHaveBeenNthCalledWith(1, "Applied 1 seat.");
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
	});
});
