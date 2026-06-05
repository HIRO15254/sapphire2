import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockPlayer {
	id: string;
	memo?: string | null;
	name: string;
	tags: Array<{ color: string; id: string; name: string }>;
}

const mocks = vi.hoisted(() => ({
	usePlayers: vi.fn(),
	create: vi.fn(),
	createTag: vi.fn(),
	players: [] as MockPlayer[],
	availableTags: [] as Array<{ color: string; id: string; name: string }>,
	isLoading: false,
	isCreatePending: false,
}));

vi.mock("@/features/players/hooks/use-players", () => ({
	usePlayers: (filterTagIds: string[]) => {
		mocks.usePlayers(filterTagIds);
		return {
			players: mocks.players,
			availableTags: mocks.availableTags,
			isLoading: mocks.isLoading,
			isCreatePending: mocks.isCreatePending,
			isUpdatePending: false,
			create: mocks.create,
			update: vi.fn(),
			delete: vi.fn(),
			createTag: mocks.createTag,
		};
	},
}));

import { usePlayersPage } from "@/features/players/pages/players-page/use-players-page";

function player(
	id: string,
	name: string,
	tags: MockPlayer["tags"] = []
): MockPlayer {
	return { id, name, memo: null, tags };
}

const VIP = { id: "vip", name: "VIP", color: "blue" };

describe("usePlayersPage", () => {
	beforeEach(() => {
		mocks.usePlayers.mockReset();
		mocks.create.mockReset().mockResolvedValue({ id: "new" });
		mocks.createTag.mockReset().mockResolvedValue({
			id: "t",
			name: "T",
			color: "gray",
		});
		mocks.players = [];
		mocks.availableTags = [];
		mocks.isLoading = false;
		mocks.isCreatePending = false;
	});

	describe("initial state", () => {
		it("has the create sheet closed, an empty search, and isSearching false", () => {
			const { result } = renderHook(() => usePlayersPage());
			expect(result.current.isCreateOpen).toBe(false);
			expect(result.current.search).toBe("");
			expect(result.current.isSearching).toBe(false);
		});

		it("forwards availableTags, isLoading, and isCreatePending", () => {
			mocks.availableTags = [VIP];
			mocks.isLoading = true;
			mocks.isCreatePending = true;
			const { result } = renderHook(() => usePlayersPage());
			expect(result.current.availableTags).toEqual([VIP]);
			expect(result.current.isLoading).toBe(true);
			expect(result.current.isCreatePending).toBe(true);
		});

		it("queries usePlayers without a server tag filter", () => {
			renderHook(() => usePlayersPage());
			expect(mocks.usePlayers).toHaveBeenLastCalledWith([]);
		});

		it("returns every player when no search term is set", () => {
			mocks.players = [player("p1", "Alice"), player("p2", "Bob")];
			const { result } = renderHook(() => usePlayersPage());
			expect(result.current.players.map((p) => p.id)).toEqual(["p1", "p2"]);
		});
	});

	describe("search filtering", () => {
		it("matches by player name (case-insensitive, substring)", () => {
			mocks.players = [player("p1", "Alice"), player("p2", "Bob")];
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setSearch("ali"));
			expect(result.current.players.map((p) => p.id)).toEqual(["p1"]);
			expect(result.current.isSearching).toBe(true);
		});

		it("matches by tag name when the name does not match", () => {
			mocks.players = [player("p1", "Alice", [VIP]), player("p2", "Bob", [])];
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setSearch("vip"));
			expect(result.current.players.map((p) => p.id)).toEqual(["p1"]);
		});

		it("returns the union of name and tag matches", () => {
			mocks.players = [
				player("p1", "Alice", [VIP]),
				player("p2", "Vivian", []),
				player("p3", "Bob", []),
			];
			const { result } = renderHook(() => usePlayersPage());
			// "vi" matches the VIP tag on p1 and the name "Vivian" on p2.
			act(() => result.current.setSearch("vi"));
			expect(result.current.players.map((p) => p.id)).toEqual(["p1", "p2"]);
		});

		it("ignores surrounding whitespace and is not case-sensitive", () => {
			mocks.players = [player("p1", "Alice")];
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setSearch("  ALICE  "));
			expect(result.current.players.map((p) => p.id)).toEqual(["p1"]);
		});

		it("treats a whitespace-only term as no search", () => {
			mocks.players = [player("p1", "Alice"), player("p2", "Bob")];
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setSearch("   "));
			expect(result.current.players.map((p) => p.id)).toEqual(["p1", "p2"]);
			expect(result.current.isSearching).toBe(false);
		});

		it("returns an empty list when nothing matches", () => {
			mocks.players = [player("p1", "Alice")];
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setSearch("zzz"));
			expect(result.current.players).toEqual([]);
			expect(result.current.isSearching).toBe(true);
		});
	});

	describe("setIsCreateOpen", () => {
		it("opens the create sheet", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setIsCreateOpen(true));
			expect(result.current.isCreateOpen).toBe(true);
		});

		it("closes the create sheet", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setIsCreateOpen(true));
			act(() => result.current.setIsCreateOpen(false));
			expect(result.current.isCreateOpen).toBe(false);
		});
	});

	describe("handleCreate", () => {
		it("forwards values to create()", async () => {
			const { result } = renderHook(() => usePlayersPage());
			await act(async () => {
				result.current.handleCreate({ name: "Bob", memo: null });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledTimes(1);
			expect(mocks.create).toHaveBeenCalledWith({ name: "Bob", memo: null });
		});

		it("closes the sheet after create resolves", async () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setIsCreateOpen(true));
			await act(async () => {
				result.current.handleCreate({ name: "Bob" });
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});

		it("keeps the sheet open when create rejects", async () => {
			const unhandled = vi.fn();
			process.on("unhandledRejection", unhandled);
			mocks.create.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setIsCreateOpen(true));
			await act(async () => {
				result.current.handleCreate({ name: "Bad" });
				await new Promise((r) => setTimeout(r, 0));
			});
			expect(result.current.isCreateOpen).toBe(true);
			process.off("unhandledRejection", unhandled);
		});
	});

	describe("createTag", () => {
		it("passes through to the data hook's createTag", async () => {
			const { result } = renderHook(() => usePlayersPage());
			await act(async () => {
				await result.current.createTag("New");
			});
			expect(mocks.createTag).toHaveBeenCalledWith("New");
		});
	});
});
