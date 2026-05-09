import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	shareSession: vi.fn(),
}));

vi.mock("@/features/sessions/utils/share-session", () => ({
	shareSession: hoisted.shareSession,
}));

import { useSessionCard } from "@/features/sessions/components/session-card/use-session-card";
import type { ShareableSession } from "@/features/sessions/utils/share-session";

const SESSION: ShareableSession = {
	kind: "cash_game",
	sessionDate: "2026-04-01",
	breakMinutes: null,
	cashBuyIn: 10_000,
	cashOut: 15_000,
	evCashOut: null,
	startedAt: null,
	endedAt: null,
	currencyUnit: "",
	storeName: null,
	ringGameName: null,
	tournamentName: null,
	tournamentBuyIn: null,
	tournamentEntryFee: null,
	beforeDeadline: null,
	placement: null,
	totalEntries: null,
	prizeMoney: null,
	bountyPrizes: null,
};

describe("useSessionCard", () => {
	beforeEach(() => {
		hoisted.shareSession.mockReset();
	});

	it("starts with isSharing=false", () => {
		const { result } = renderHook(() => useSessionCard(SESSION));
		expect(result.current.isSharing).toBe(false);
	});

	it("onShare flips isSharing while the share is in flight and resets it afterwards", async () => {
		let resolveShare: (() => void) | undefined;
		hoisted.shareSession.mockImplementation(
			() =>
				new Promise<void>((r) => {
					resolveShare = r;
				})
		);
		const { result } = renderHook(() => useSessionCard(SESSION));
		let sharePromise: Promise<void> | undefined;
		act(() => {
			sharePromise = result.current.onShare();
		});
		await waitFor(() => expect(result.current.isSharing).toBe(true));
		resolveShare?.();
		await sharePromise;
		await waitFor(() => expect(result.current.isSharing).toBe(false));
		expect(hoisted.shareSession).toHaveBeenCalledWith(SESSION);
	});

	it("onShare resets isSharing even when shareSession rejects", async () => {
		hoisted.shareSession.mockRejectedValueOnce(new Error("no share"));
		const { result } = renderHook(() => useSessionCard(SESSION));
		await act(async () => {
			await expect(result.current.onShare()).rejects.toThrow("no share");
		});
		expect(result.current.isSharing).toBe(false);
	});
});
