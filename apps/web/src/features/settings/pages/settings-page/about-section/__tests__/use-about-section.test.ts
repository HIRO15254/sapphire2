import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	open: vi.fn(),
	latestVersion: "v3.2.2" as string | null,
}));

vi.mock("@/features/update-notes/components/update-notes-sheet", () => ({
	useUpdateNotesSheet: () => ({
		isOpen: false,
		open: mocks.open,
		close: vi.fn(),
		setIsOpen: vi.fn(),
	}),
}));

vi.mock("@/features/update-notes/constants", () => ({
	get LATEST_VERSION() {
		return mocks.latestVersion;
	},
}));

import { useAboutSection } from "../use-about-section";

describe("useAboutSection", () => {
	it("returns the latest release version", () => {
		mocks.latestVersion = "v3.2.2";
		const { result } = renderHook(() => useAboutSection());
		expect(result.current.version).toBe("v3.2.2");
	});

	it("returns null for version when there is no published release", () => {
		mocks.latestVersion = null;
		const { result } = renderHook(() => useAboutSection());
		expect(result.current.version).toBeNull();
	});

	it("exposes the sheet's open handler as onViewUpdateNotes", () => {
		mocks.open.mockClear();
		const { result } = renderHook(() => useAboutSection());

		result.current.onViewUpdateNotes();

		expect(mocks.open).toHaveBeenCalledTimes(1);
	});
});
