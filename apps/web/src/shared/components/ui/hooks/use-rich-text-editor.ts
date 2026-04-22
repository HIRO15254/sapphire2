import Link from "@tiptap/extension-link";
import type { Editor } from "@tiptap/react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useState } from "react";

interface UseRichTextEditorOptions {
	initialContent?: string | null;
	onChange: (html: string) => void;
}

interface UseRichTextEditorResult {
	applyLink: () => void;
	cancelLinkInput: () => void;
	editor: Editor | null;
	linkUrl: string;
	onLinkUrlChange: (url: string) => void;
	openLinkInput: () => void;
	removeLink: () => void;
	showLinkInput: boolean;
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
		applyLink,
		cancelLinkInput,
		editor,
		linkUrl,
		onLinkUrlChange: setLinkUrl,
		openLinkInput,
		removeLink,
		showLinkInput,
	};
}
