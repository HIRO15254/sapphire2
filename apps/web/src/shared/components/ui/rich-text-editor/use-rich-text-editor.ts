import Link from "@tiptap/extension-link";
import type { Editor } from "@tiptap/react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useState } from "react";

/**
 * Toolbar formatting keys. These double as the `value`s of the toolbar
 * `ToggleGroupItem`s, so the group's controlled `value` can be derived
 * straight from the editor's active marks/nodes.
 */
export type RichTextFormat =
	| "bold"
	| "italic"
	| "h2"
	| "h3"
	| "bulletList"
	| "orderedList";

interface UseRichTextEditorOptions {
	initialContent?: string | null;
	onChange: (html: string) => void;
}

interface UseRichTextEditorResult {
	activeFormats: RichTextFormat[];
	applyLink: () => void;
	cancelLinkInput: () => void;
	editor: Editor | null;
	linkUrl: string;
	onFormatsChange: (next: string[]) => void;
	onLinkUrlChange: (url: string) => void;
	openLinkInput: () => void;
	removeLink: () => void;
	showLinkInput: boolean;
}

function readActiveFormats(editor: Editor): RichTextFormat[] {
	const active: RichTextFormat[] = [];
	if (editor.isActive("bold")) {
		active.push("bold");
	}
	if (editor.isActive("italic")) {
		active.push("italic");
	}
	if (editor.isActive("heading", { level: 2 })) {
		active.push("h2");
	}
	if (editor.isActive("heading", { level: 3 })) {
		active.push("h3");
	}
	if (editor.isActive("bulletList")) {
		active.push("bulletList");
	}
	if (editor.isActive("orderedList")) {
		active.push("orderedList");
	}
	return active;
}

function runFormatCommand(editor: Editor, format: RichTextFormat): void {
	const chain = editor.chain().focus();
	switch (format) {
		case "bold":
			chain.toggleBold();
			break;
		case "italic":
			chain.toggleItalic();
			break;
		case "h2":
			chain.toggleHeading({ level: 2 });
			break;
		case "h3":
			chain.toggleHeading({ level: 3 });
			break;
		case "bulletList":
			chain.toggleBulletList();
			break;
		case "orderedList":
			chain.toggleOrderedList();
			break;
		default:
			break;
	}
	chain.run();
}

const FORMAT_KEYS: readonly RichTextFormat[] = [
	"bold",
	"italic",
	"h2",
	"h3",
	"bulletList",
	"orderedList",
];

function isRichTextFormat(value: string): value is RichTextFormat {
	return (FORMAT_KEYS as readonly string[]).includes(value);
}

export function useRichTextEditor({
	initialContent,
	onChange,
}: UseRichTextEditorOptions): UseRichTextEditorResult {
	const [showLinkInput, setShowLinkInput] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: { levels: [2, 3] },
			}),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
			}),
		],
		content: initialContent ?? "",
		shouldRerenderOnTransaction: true,
		onUpdate: ({ editor: ed }) => {
			const html = ed.getHTML();
			const emptyContent = "<p></p>";
			onChange(html === emptyContent ? "" : html);
		},
	});

	// `ToggleGroup` is controlled off the editor's live state. The group reports
	// the *desired* next selection; we diff it against the current state and run
	// the single command for whichever item the user toggled (headings convert
	// rather than stack, so the symmetric difference is always one key).
	const onFormatsChange = useCallback(
		(next: string[]) => {
			if (!editor) {
				return;
			}
			const current = readActiveFormats(editor);
			const currentSet = new Set<string>(current);
			const nextSet = new Set(next);
			const toggled = [
				...current.filter((key) => !nextSet.has(key)),
				...next.filter((key) => !currentSet.has(key)),
			];
			for (const key of toggled) {
				if (isRichTextFormat(key)) {
					runFormatCommand(editor, key);
				}
			}
		},
		[editor]
	);

	const openLinkInput = useCallback(() => {
		if (!editor) {
			return;
		}
		const existingHref = editor.getAttributes("link").href as
			| string
			| undefined;
		setLinkUrl(existingHref ?? "https://");
		setShowLinkInput(true);
	}, [editor]);

	const applyLink = useCallback(() => {
		if (!editor) {
			return;
		}
		if (linkUrl.trim() === "") {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
		} else {
			editor
				.chain()
				.focus()
				.extendMarkRange("link")
				.setLink({ href: linkUrl.trim() })
				.run();
		}
		setShowLinkInput(false);
		setLinkUrl("");
	}, [editor, linkUrl]);

	const removeLink = useCallback(() => {
		if (!editor) {
			return;
		}
		editor.chain().focus().extendMarkRange("link").unsetLink().run();
		setShowLinkInput(false);
		setLinkUrl("");
	}, [editor]);

	const cancelLinkInput = () => {
		setShowLinkInput(false);
		setLinkUrl("");
	};

	return {
		activeFormats: editor ? readActiveFormats(editor) : [],
		applyLink,
		cancelLinkInput,
		editor,
		linkUrl,
		onFormatsChange,
		onLinkUrlChange: setLinkUrl,
		openLinkInput,
		removeLink,
		showLinkInput,
	};
}
