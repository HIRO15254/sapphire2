import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const editorState = vi.hoisted(() => ({
	editorNull: false,
	activeMarks: new Set<string>(),
	linkHref: undefined as string | undefined,
	chainCalls: [] as string[][],
}));

function buildChain(path: string[]) {
	const chain = {
		focus: () => {
			path.push("focus");
			return chain;
		},
		extendMarkRange: () => {
			path.push("extendMarkRange");
			return chain;
		},
		unsetLink: () => {
			path.push("unsetLink");
			return chain;
		},
		setLink: (attrs: { href: string }) => {
			path.push(`setLink:${attrs.href}`);
			return chain;
		},
		toggleBold: () => {
			path.push("toggleBold");
			return chain;
		},
		toggleItalic: () => {
			path.push("toggleItalic");
			return chain;
		},
		toggleHeading: (attrs: { level: number }) => {
			path.push(`toggleHeading:${attrs.level}`);
			return chain;
		},
		toggleBulletList: () => {
			path.push("toggleBulletList");
			return chain;
		},
		toggleOrderedList: () => {
			path.push("toggleOrderedList");
			return chain;
		},
		run: () => {
			path.push("run");
			editorState.chainCalls.push([...path]);
			return true;
		},
	};
	return chain;
}

vi.mock("@tiptap/react", () => ({
	useEditor: () =>
		editorState.editorNull
			? null
			: {
					getAttributes: (mark: string) =>
						mark === "link" && editorState.linkHref
							? { href: editorState.linkHref }
							: {},
					isActive: (name: string, attrs?: { level?: number }) => {
						if (name === "heading") {
							return editorState.activeMarks.has(
								attrs?.level === 2 ? "h2" : "h3"
							);
						}
						if (name === "link") {
							return Boolean(editorState.linkHref);
						}
						return editorState.activeMarks.has(name);
					},
					chain: () => buildChain([]),
				},
	EditorContent: ({ className }: { className?: string }) => (
		<div className={className} data-testid="editor-content" />
	),
}));

vi.mock("@tiptap/extension-link", () => ({
	default: { configure: () => ({}) },
}));
vi.mock("@tiptap/starter-kit", () => ({ default: { configure: () => ({}) } }));

import { RichTextEditor } from "@/shared/components/ui/rich-text-editor/rich-text-editor";

const TOOLBAR_LABELS = [
	"Bold",
	"Italic",
	"Heading 2",
	"Heading 3",
	"Bullet list",
	"Ordered list",
	"Link",
];

describe("RichTextEditor", () => {
	beforeEach(() => {
		editorState.editorNull = false;
		editorState.activeMarks = new Set();
		editorState.linkHref = undefined;
		editorState.chainCalls.length = 0;
	});

	it("renders nothing until the editor is ready", () => {
		editorState.editorNull = true;
		const { container } = render(<RichTextEditor onChange={vi.fn()} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders the full formatting toolbar and the editor surface", () => {
		render(<RichTextEditor onChange={vi.fn()} />);
		for (const label of TOOLBAR_LABELS) {
			expect(screen.getByLabelText(label)).toBeInTheDocument();
		}
		expect(screen.getByTestId("editor-content")).toBeInTheDocument();
	});

	it("marks only the active format as pressed", () => {
		editorState.activeMarks = new Set(["bold"]);
		render(<RichTextEditor onChange={vi.fn()} />);
		expect(screen.getByLabelText("Bold")).toHaveAttribute("data-state", "on");
		expect(screen.getByLabelText("Italic")).toHaveAttribute(
			"data-state",
			"off"
		);
	});

	it("runs the bold command when the Bold toggle is clicked", async () => {
		const user = userEvent.setup();
		render(<RichTextEditor onChange={vi.fn()} />);
		await user.click(screen.getByLabelText("Bold"));
		expect(editorState.chainCalls.at(-1)).toContain("toggleBold");
	});

	it("runs the ordered-list command when its toggle is clicked", async () => {
		const user = userEvent.setup();
		render(<RichTextEditor onChange={vi.fn()} />);
		await user.click(screen.getByLabelText("Ordered list"));
		expect(editorState.chainCalls.at(-1)).toContain("toggleOrderedList");
	});

	it("reveals the link URL input seeded with https:// when Link is clicked", async () => {
		const user = userEvent.setup();
		render(<RichTextEditor onChange={vi.fn()} />);
		expect(screen.queryByDisplayValue("https://")).not.toBeInTheDocument();
		await user.click(screen.getByLabelText("Link"));
		expect(screen.getByDisplayValue("https://")).toBeInTheDocument();
	});

	it("applies the link on Enter and closes the input", async () => {
		const user = userEvent.setup();
		render(<RichTextEditor onChange={vi.fn()} />);
		await user.click(screen.getByLabelText("Link"));
		const input = screen.getByDisplayValue("https://");
		await user.clear(input);
		await user.type(input, "https://foo.test{Enter}");
		expect(editorState.chainCalls.at(-1)).toContain("setLink:https://foo.test");
		expect(
			screen.queryByDisplayValue("https://foo.test")
		).not.toBeInTheDocument();
	});

	it("closes the link input on Escape without running a command", async () => {
		const user = userEvent.setup();
		render(<RichTextEditor onChange={vi.fn()} />);
		await user.click(screen.getByLabelText("Link"));
		const input = screen.getByDisplayValue("https://");
		editorState.chainCalls.length = 0;
		await user.type(input, "{Escape}");
		expect(screen.queryByDisplayValue("https://")).not.toBeInTheDocument();
		expect(editorState.chainCalls).toHaveLength(0);
	});

	it("shows the Remove link action only when a link is active", async () => {
		const user = userEvent.setup();
		editorState.linkHref = "https://current.test";
		render(<RichTextEditor onChange={vi.fn()} />);
		await user.click(screen.getByLabelText("Link"));
		expect(screen.getByLabelText("Remove link")).toBeInTheDocument();
	});

	it("hides the Remove link action when no link is active", async () => {
		const user = userEvent.setup();
		render(<RichTextEditor onChange={vi.fn()} />);
		await user.click(screen.getByLabelText("Link"));
		expect(screen.queryByLabelText("Remove link")).not.toBeInTheDocument();
	});
});
