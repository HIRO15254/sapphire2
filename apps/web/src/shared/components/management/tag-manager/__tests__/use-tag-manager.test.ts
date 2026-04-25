import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTagManager } from "@/shared/components/management/tag-manager/use-tag-manager";

interface Tag {
	id: string;
	name: string;
}

const vipTag: Tag = { id: "tag-vip", name: "VIP" };
const banTag: Tag = { id: "tag-ban", name: "Banned" };

describe("useTagManager", () => {
	it("starts with all dialogs closed", () => {
		const { result } = renderHook(() => useTagManager<Tag>());
		expect(result.current.isCreateOpen).toBe(false);
		expect(result.current.editingTag).toBeNull();
		expect(result.current.deletingTag).toBeNull();
	});

	it("onOpenCreate / onCloseCreate toggles create dialog", () => {
		const { result } = renderHook(() => useTagManager<Tag>());
		act(() => result.current.onOpenCreate());
		expect(result.current.isCreateOpen).toBe(true);
		act(() => result.current.onCloseCreate());
		expect(result.current.isCreateOpen).toBe(false);
	});

	it("onStartEdit sets the editing tag", () => {
		const { result } = renderHook(() => useTagManager<Tag>());
		act(() => result.current.onStartEdit(vipTag));
		expect(result.current.editingTag).toBe(vipTag);
	});

	it("onCloseEdit clears the editing tag", () => {
		const { result } = renderHook(() => useTagManager<Tag>());
		act(() => result.current.onStartEdit(vipTag));
		act(() => result.current.onCloseEdit());
		expect(result.current.editingTag).toBeNull();
	});

	it("onStartDelete sets the deleting tag", () => {
		const { result } = renderHook(() => useTagManager<Tag>());
		act(() => result.current.onStartDelete(banTag));
		expect(result.current.deletingTag).toBe(banTag);
	});

	it("onCloseDelete clears the deleting tag", () => {
		const { result } = renderHook(() => useTagManager<Tag>());
		act(() => result.current.onStartDelete(banTag));
		act(() => result.current.onCloseDelete());
		expect(result.current.deletingTag).toBeNull();
	});

	it("switching edit target updates editingTag but not deletingTag", () => {
		const { result } = renderHook(() => useTagManager<Tag>());
		act(() => result.current.onStartEdit(vipTag));
		act(() => result.current.onStartEdit(banTag));
		expect(result.current.editingTag).toBe(banTag);
		expect(result.current.deletingTag).toBeNull();
	});

	it("create and edit can be open simultaneously (independent state)", () => {
		const { result } = renderHook(() => useTagManager<Tag>());
		act(() => result.current.onOpenCreate());
		act(() => result.current.onStartEdit(vipTag));
		expect(result.current.isCreateOpen).toBe(true);
		expect(result.current.editingTag).toBe(vipTag);
	});
});
