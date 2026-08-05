import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SeatPlayer } from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";
import { useSeatTable } from "../use-seat-table";

function makePlayer(overrides: Partial<SeatPlayer> = {}): SeatPlayer {
	return {
		id: "tp-1",
		isLoading: false,
		isTemporary: false,
		memo: null,
		name: "Alice",
		playerId: "p-1",
		seatPosition: 0,
		tags: [],
		...overrides,
	};
}

function setup() {
	const options = {
		onRemovePlayer: vi.fn(),
		onSeatExisting: vi.fn(),
		onSeatHero: vi.fn(),
		onSeatNew: vi.fn(),
		onSeatTemporary: vi.fn(),
		onUnseatHero: vi.fn(),
	};
	const rendered = renderHook(() => useSeatTable(options));
	return { options, rendered };
}

describe("useSeatTable", () => {
	it("starts with no open drawer", () => {
		const { rendered } = setup();
		expect(rendered.result.current.activeEmptySeat).toBeNull();
		expect(rendered.result.current.activePlayer).toBeNull();
	});

	it("onEmptySeatTap opens the seating drawer for that seat", () => {
		const { rendered } = setup();
		act(() => rendered.result.current.onEmptySeatTap(3));
		expect(rendered.result.current.activeEmptySeat).toBe(3);
	});

	it("onEmptySeatTap accepts seat position 0", () => {
		const { rendered } = setup();
		act(() => rendered.result.current.onEmptySeatTap(0));
		expect(rendered.result.current.activeEmptySeat).toBe(0);
	});

	it("onCloseEmptySeat closes the seating drawer", () => {
		const { rendered } = setup();
		act(() => rendered.result.current.onEmptySeatTap(3));
		act(() => rendered.result.current.onCloseEmptySeat());
		expect(rendered.result.current.activeEmptySeat).toBeNull();
	});

	it("onSeatExisting delegates with the active seat and closes the drawer", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onEmptySeatTap(2));
		act(() => rendered.result.current.onSeatExisting("p-9", "Nina"));
		expect(options.onSeatExisting).toHaveBeenCalledTimes(1);
		expect(options.onSeatExisting).toHaveBeenNthCalledWith(1, 2, "p-9", "Nina");
		expect(rendered.result.current.activeEmptySeat).toBeNull();
	});

	it("onSeatExisting is a no-op when no seat drawer is open", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onSeatExisting("p-9", "Nina"));
		expect(options.onSeatExisting).not.toHaveBeenCalled();
	});

	it("onSeatNew delegates with the active seat and values, then closes", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onEmptySeatTap(4));
		act(() => rendered.result.current.onSeatNew({ name: "New guy" }));
		expect(options.onSeatNew).toHaveBeenCalledTimes(1);
		expect(options.onSeatNew).toHaveBeenNthCalledWith(1, 4, {
			name: "New guy",
		});
		expect(rendered.result.current.activeEmptySeat).toBeNull();
	});

	it("onSeatNew is a no-op when no seat drawer is open", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onSeatNew({ name: "New guy" }));
		expect(options.onSeatNew).not.toHaveBeenCalled();
	});

	it("onSeatTemporary delegates with the active seat and closes", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onEmptySeatTap(1));
		act(() => rendered.result.current.onSeatTemporary());
		expect(options.onSeatTemporary).toHaveBeenCalledTimes(1);
		expect(options.onSeatTemporary).toHaveBeenNthCalledWith(1, 1);
		expect(rendered.result.current.activeEmptySeat).toBeNull();
	});

	it("onSeatTemporary is a no-op when no seat drawer is open", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onSeatTemporary());
		expect(options.onSeatTemporary).not.toHaveBeenCalled();
	});

	it("onSeatHero delegates with the active seat and closes", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onEmptySeatTap(0));
		act(() => rendered.result.current.onSeatHero());
		expect(options.onSeatHero).toHaveBeenCalledTimes(1);
		expect(options.onSeatHero).toHaveBeenNthCalledWith(1, 0);
		expect(rendered.result.current.activeEmptySeat).toBeNull();
	});

	it("onSeatHero is a no-op when no seat drawer is open", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onSeatHero());
		expect(options.onSeatHero).not.toHaveBeenCalled();
	});

	it("onPlayerTap opens the edit drawer for that player", () => {
		const { rendered } = setup();
		const player = makePlayer();
		act(() => rendered.result.current.onPlayerTap(player));
		expect(rendered.result.current.activePlayer).toBe(player);
	});

	it("onClosePlayer closes the edit drawer", () => {
		const { rendered } = setup();
		act(() => rendered.result.current.onPlayerTap(makePlayer()));
		act(() => rendered.result.current.onClosePlayer());
		expect(rendered.result.current.activePlayer).toBeNull();
	});

	it("onUnseatActivePlayer removes the open player and closes the drawer", () => {
		const { options, rendered } = setup();
		act(() =>
			rendered.result.current.onPlayerTap(makePlayer({ playerId: "p-7" }))
		);
		act(() => rendered.result.current.onUnseatActivePlayer());
		expect(options.onRemovePlayer).toHaveBeenCalledTimes(1);
		expect(options.onRemovePlayer).toHaveBeenNthCalledWith(1, "p-7");
		expect(rendered.result.current.activePlayer).toBeNull();
	});

	it("onUnseatActivePlayer is a no-op when no player drawer is open", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onUnseatActivePlayer());
		expect(options.onRemovePlayer).not.toHaveBeenCalled();
	});

	it("onHeroSeatTap unseats the hero directly", () => {
		const { options, rendered } = setup();
		act(() => rendered.result.current.onHeroSeatTap());
		expect(options.onUnseatHero).toHaveBeenCalledTimes(1);
	});

	it("opening a seat drawer does not touch the player drawer and vice versa", () => {
		const { rendered } = setup();
		act(() => rendered.result.current.onEmptySeatTap(5));
		act(() => rendered.result.current.onPlayerTap(makePlayer()));
		expect(rendered.result.current.activeEmptySeat).toBe(5);
		expect(rendered.result.current.activePlayer).not.toBeNull();
	});
});
