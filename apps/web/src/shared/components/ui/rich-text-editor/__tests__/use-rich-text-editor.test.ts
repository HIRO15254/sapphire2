import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type UpdateCallback = (ctx: { editor: { getHTML: () => string } }) => void;

const editorState = vi.hoisted(() => ({
	onUpdate: null as UpdateCallback | null,
	linkAttrs: {} as { href?: string },
	activeMarks: new Set<string>(),
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
		toggleBold: () => {
			trackingPath.push("toggleBold");
			return chain;
		},
		toggleItalic: () => {
			trackingPath.push("toggleItalic");
			return chain;
		},
		toggleHeading: (attrs: { level: number }) => {
			trackingPath.push(`toggleHeading:${attrs.level}`);
			return chain;
		},
		toggleBulletList: () => {
			trackingPath.push("toggleBulletList");
			return chain;
		},
		toggleOrderedList: () => {
			trackingPath.push("toggleOrderedList");
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
			isActive: (name: string, attrs?: { level?: number }) => {
				if (name === "heading") {
					const key = attrs?.level === 2 ? "h2" : "h3";
					return editorState.activeMarks.has(key);
				}
				if (name === "link") {
					return Boolean(editorState.linkAttrs.href);
				}
				return editorState.activeMarks.has(name);
			},
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
		editorState.activeMarks = new Set();
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

	describe("activeFormats", () => {
		it("is empty when no marks/nodes are active", () => {
			editorState.activeMarks = new Set();
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			expect(result.current.activeFormats).toEqual([]);
		});

		it("reflects active bold and italic marks in declared order", () => {
			editorState.activeMarks = new Set(["italic", "bold"]);
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			expect(result.current.activeFormats).toEqual(["bold", "italic"]);
		});

		it("maps heading level 2 to 'h2'", () => {
			editorState.activeMarks = new Set(["h2"]);
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			expect(result.current.activeFormats).toEqual(["h2"]);
		});

		it("maps heading level 3 to 'h3'", () => {
			editorState.activeMarks = new Set(["h3"]);
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			expect(result.current.activeFormats).toEqual(["h3"]);
		});

		it("reflects bullet and ordered lists", () => {
			editorState.activeMarks = new Set(["bulletList"]);
			const bullet = renderHook(() => useRichTextEditor({ onChange: vi.fn() }));
			expect(bullet.result.current.activeFormats).toEqual(["bulletList"]);

			editorState.activeMarks = new Set(["orderedList"]);
			const ordered = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			expect(ordered.result.current.activeFormats).toEqual(["orderedList"]);
		});
	});

	describe("onFormatsChange", () => {
		it("runs toggleBold when bold is newly selected", () => {
			editorState.activeMarks = new Set();
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.onFormatsChange(["bold"]));
			expect(editorState.chainCalls.at(-1)).toContain("toggleBold");
		});

		it("runs toggleBold when bold is deselected", () => {
			editorState.activeMarks = new Set(["bold"]);
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.onFormatsChange([]));
			expect(editorState.chainCalls.at(-1)).toContain("toggleBold");
		});

		it("runs toggleItalic for italic", () => {
			editorState.activeMarks = new Set();
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.onFormatsChange(["italic"]));
			expect(editorState.chainCalls.at(-1)).toContain("toggleItalic");
		});

		it("runs toggleHeading level 2 for 'h2'", () => {
			editorState.activeMarks = new Set();
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.onFormatsChange(["h2"]));
			expect(editorState.chainCalls.at(-1)).toContain("toggleHeading:2");
		});

		it("runs toggleHeading level 3 for 'h3'", () => {
			editorState.activeMarks = new Set();
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.onFormatsChange(["h3"]));
			expect(editorState.chainCalls.at(-1)).toContain("toggleHeading:3");
		});

		it("converts h3 to h2 by running toggleHeading:2 (symmetric diff is one key)", () => {
			editorState.activeMarks = new Set(["h3"]);
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.onFormatsChange(["h3", "h2"]));
			expect(editorState.chainCalls.at(-1)).toContain("toggleHeading:2");
		});

		it("runs toggleBulletList for bulletList", () => {
			editorState.activeMarks = new Set();
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.onFormatsChange(["bulletList"]));
			expect(editorState.chainCalls.at(-1)).toContain("toggleBulletList");
		});

		it("runs toggleOrderedList for orderedList", () => {
			editorState.activeMarks = new Set();
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			act(() => result.current.onFormatsChange(["orderedList"]));
			expect(editorState.chainCalls.at(-1)).toContain("toggleOrderedList");
		});

		it("ignores unknown values without running any command", () => {
			editorState.activeMarks = new Set();
			const { result } = renderHook(() =>
				useRichTextEditor({ onChange: vi.fn() })
			);
			editorState.chainCalls.length = 0;
			act(() => result.current.onFormatsChange(["strikethrough"]));
			expect(editorState.chainCalls).toHaveLength(0);
		});
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
