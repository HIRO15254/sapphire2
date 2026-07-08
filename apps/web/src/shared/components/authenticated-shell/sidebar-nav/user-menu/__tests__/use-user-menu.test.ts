import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	useSession: vi.fn(),
	updateNotesSheet: {
		isOpen: false,
		open: vi.fn(),
		close: vi.fn(),
		setIsOpen: vi.fn(),
	},
	onSignOut: vi.fn(),
	useSignOut: vi.fn(),
	useUpdateNotesSheet: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: mocks.useSession,
	},
}));

vi.mock("@/features/update-notes/components/update-notes-sheet", () => ({
	useUpdateNotesSheet: mocks.useUpdateNotesSheet,
}));

vi.mock("@/shared/hooks/use-sign-out", () => ({
	useSignOut: mocks.useSignOut,
}));

import { useUserMenu } from "@/shared/components/authenticated-shell/sidebar-nav/user-menu/use-user-menu";

describe("useUserMenu", () => {
	beforeEach(() => {
		mocks.useSession.mockReset();
		mocks.onSignOut.mockReset();
		mocks.useSignOut.mockReset();
		mocks.useUpdateNotesSheet.mockReset();
		mocks.useSignOut.mockReturnValue({ onSignOut: mocks.onSignOut });
		mocks.useUpdateNotesSheet.mockReturnValue(mocks.updateNotesSheet);
	});

	it("exposes the authenticated session and update-notes controls", () => {
		const session = {
			data: { user: { email: "hero@example.com", name: "Hero User" } },
			isPending: false,
		};
		mocks.useSession.mockReturnValue(session);

		const { result } = renderHook(() => useUserMenu());

		expect(result.current.session).toBe(session.data);
		expect(result.current.isPending).toBe(false);
		expect(result.current.updateNotesSheet).toBe(mocks.updateNotesSheet);
	});

	it("surfaces isPending while the session is loading", () => {
		mocks.useSession.mockReturnValue({ data: null, isPending: true });

		const { result } = renderHook(() => useUserMenu());

		expect(result.current.isPending).toBe(true);
		expect(result.current.session).toBeNull();
	});

	it("delegates sign-out to the shared useSignOut hook", () => {
		mocks.useSession.mockReturnValue({ data: null, isPending: false });

		const { result } = renderHook(() => useUserMenu());
		result.current.onSignOut();

		expect(mocks.useSignOut).toHaveBeenCalledTimes(1);
		expect(result.current.onSignOut).toBe(mocks.onSignOut);
		expect(mocks.onSignOut).toHaveBeenCalledTimes(1);
	});
});
