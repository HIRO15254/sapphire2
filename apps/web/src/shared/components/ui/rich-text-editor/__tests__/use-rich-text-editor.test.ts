import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type UpdateCallback = (ctx: { editor: { getHTML: () => string } }) => void;

const editorState = vi.hoisted(() => ({
	onUpdate: null as UpdateCallback | null,
	linkAttrs: {} as { href?: string },
	chainCalls: [] as string[][],
	resetLinkChain: vi.fn(),
	setLinkChain: vi.fn(),
	focusChain: vi.fn(),
	lastHtml: "<p>Hello</p>",
}));

function buildChain(trackingPath: string[]) {
	const chain = {
		focus: () => {
			trackingPath.push("focus");
			return chain;
		},
		extendMarkRange: (_mark: string) => {
			trackingPath.push("extendMarkRange");
			return chain;
		},
		unsetLink: () => {
			trackingPath.push("unsetLink");
			return chain;
		},
		setLink: (attrs: { href: string }) => {
			trackingPath.push(`setLink:${attrs.href}`);
			return chain;
		},
		run: () => {
			trackingPath.push("run");
			editorState.chainCalls.push([...trackingPath]);
			return true;
		},
	};
	return chain;
}

vi.mock("@tiptap/react", () => ({
	useEditor: (options: { onUpdate?: UpdateCallback }) => {
		editorState.onUpdate = options.onUpdate ?? null;
		return {
			getHTML: () => editorState.lastHtml,
			getAttributes: (mark: string) =>
				mark === "link" ? editorState.linkAttrs : {},
			chain: () => buildChain([]),
		};
	},
}));

vi.mock("@tiptap/extension-link", () => ({
	default: {
		configure: () => ({}),
	},
}));

vi.mock("@tiptap/starter-kit", () => ({
	default: {
		configure: () => ({}),
	},
}));

import { useRichTextEditor } from "@/shared/components/ui/rich-text-editor/use-rich-text-editor";

describe("useRichTextEditor", () => {
	beforeEach(() => {
		editorState.chainCalls.length = 0;
		editorState.linkAttrs = {};
	});

	it("starts with linkUrl empty and showLinkInput=false", () => {
		const { result } = renderHook(() =>
			useRichTextEditor({ onChange: vi.fn() })
		);
		expect(result.current.linkUrl).toBe("");
		expect(result.current.showLinkInput).toBe(false);
		expect(result.current.editor).not.toBeNull();
	});

	it("onChange receives '' when editor html is the empty <p></p>", () => {
		const onChange = vi.fn();
		renderHook(() => useRichTextEditor({ onChange }));
		editorState.lastHtml = "<p></p>";
		editorState.onUpdate?.({ editor: { getHTML: () => "<p></p>" } });
		expect(onChange).toHaveBeenCalledWith("");
	});

	it("onChange receives the actual html when non-empty", () => {
		const onChange = vi.fn();
		renderHook(() => useRichTextEditor({ onChange }));
		editorState.lastHtml = "<p>Hello</p>";
		editorState.onUpdate?.({ editor: { getHTML: () => "<p>Hello</p>" } });
		expect(onChange).toHaveBeenCalledWith("<p>Hello</p>");
	});

	describe("openLinkInput", () => {
		it("seeds linkUrl from the current link mark href", () => {
			editorState.linkAttrs = { href: "https://existing.test" };
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.openLinkInput());
			expect(result.current.linkUrl).toBe("https://existing.test");
			expect(result.current.showLinkInput).toBe(true);
		});

		it("falls back to 'https://' when no existing link", () => {
			editorState.linkAttrs = {};
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.openLinkInput());
			expect(result.current.linkUrl).toBe("https://");
			expect(result.current.showLinkInput).toBe(true);
		});
	});

	describe("applyLink", () => {
		it("when linkUrl is blank: runs unsetLink chain", () => {
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.openLinkInput());
			act(() => result.current.onLinkUrlChange("   "));
			act(() => result.current.applyLink());
			const lastCall = editorState.chainCalls.at(-1);
			expect(lastCall).toContain("unsetLink");
			expect(result.current.showLinkInput).toBe(false);
			expect(result.current.linkUrl).toBe("");
		});

		it("when linkUrl is set: runs setLink with the trimmed url", () => {
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.openLinkInput());
			act(() => result.current.onLinkUrlChange("  https://foo.test  "));
			act(() => result.current.applyLink());
			const lastCall = editorState.chainCalls.at(-1);
			expect(lastCall).toContain("setLink:https://foo.test");
			expect(result.current.showLinkInput).toBe(false);
			expect(result.current.linkUrl).toBe("");
		});
	});

	describe("removeLink", () => {
		it("runs the unsetLink chain and closes the input", () => {
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.openLinkInput());
			act(() => result.current.removeLink());
			const lastCall = editorState.chainCalls.at(-1);
			expect(lastCall).toContain("unsetLink");
			expect(result.current.showLinkInput).toBe(false);
			expect(result.current.linkUrl).toBe("");
		});
	});

	describe("cancelLinkInput", () => {
		it("closes the input without running any editor commands", () => {
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.openLinkInput());
			editorState.chainCalls.length = 0;
			act(() => result.current.cancelLinkInput());
			expect(editorState.chainCalls).toHaveLength(0);
			expect(result.current.showLinkInput).toBe(false);
			expect(result.current.linkUrl).toBe("");
		});
	});
});
