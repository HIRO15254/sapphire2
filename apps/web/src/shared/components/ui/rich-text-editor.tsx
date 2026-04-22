import {
	IconBold,
	IconCheck,
	IconH2,
	IconH3,
	IconItalic,
	IconLink,
	IconLinkOff,
	IconList,
	IconListNumbers,
	IconX,
} from "@tabler/icons-react";
import { EditorContent } from "@tiptap/react";
import { Button } from "@/shared/components/ui/button";
import { useRichTextEditor } from "@/shared/components/ui/hooks/use-rich-text-editor";
import { Input } from "@/shared/components/ui/input";

interface RichTextEditorProps {
	initialContent?: string | null;
	onChange: (html: string) => void;
}

export function RichTextEditor({
	initialContent,
	onChange,
}: RichTextEditorProps) {
	const {
		applyLink,
		cancelLinkInput,
		editor,
		linkUrl,
		onLinkUrlChange,
		openLinkInput,
		removeLink,
		showLinkInput,
	} = useRichTextEditor({ initialContent, onChange });

	if (!editor) {
		return null;
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap gap-1 rounded-md border p-1">
				<ToolbarButton
					active={editor.isActive("bold")}
					label="Bold"
					onClick={() => editor.chain().focus().toggleBold().run()}
				>
					<IconBold size={16} />
				</ToolbarButton>
				<ToolbarButton
					active={editor.isActive("italic")}
					label="Italic"
					onClick={() => editor.chain().focus().toggleItalic().run()}
				>
					<IconItalic size={16} />
				</ToolbarButton>
				<ToolbarButton
					active={editor.isActive("heading", { level: 2 })}
					label="Heading 2"
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 2 }).run()
					}
				>
					<IconH2 size={16} />
				</ToolbarButton>
				<ToolbarButton
					active={editor.isActive("heading", { level: 3 })}
					label="Heading 3"
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 3 }).run()
					}
				>
					<IconH3 size={16} />
				</ToolbarButton>
				<ToolbarButton
					active={editor.isActive("bulletList")}
					label="Bullet list"
					onClick={() => editor.chain().focus().toggleBulletList().run()}
				>
					<IconList size={16} />
				</ToolbarButton>
				<ToolbarButton
					active={editor.isActive("orderedList")}
					label="Ordered list"
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
				>
					<IconListNumbers size={16} />
				</ToolbarButton>
				<ToolbarButton
					active={editor.isActive("link")}
					label="Link"
					onClick={openLinkInput}
				>
					<IconLink size={16} />
				</ToolbarButton>
			</div>

			{showLinkInput && (
				<div className="flex items-center gap-2 rounded-md border p-2">
					<Input
						autoFocus
						className="h-8 flex-1"
						onChange={(e) => onLinkUrlChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								applyLink();
							}
							if (e.key === "Escape") {
								cancelLinkInput();
							}
						}}
						placeholder="https://example.com"
						type="url"
						value={linkUrl}
					/>
					<Button
						aria-label="Apply link"
						onClick={applyLink}
						size="sm"
						type="button"
						variant="ghost"
					>
						<IconCheck size={16} />
					</Button>
					{editor.isActive("link") && (
						<Button
							aria-label="Remove link"
							onClick={removeLink}
							size="sm"
							type="button"
							variant="ghost"
						>
							<IconLinkOff size={16} />
						</Button>
					)}
					<Button
						aria-label="Cancel"
						onClick={cancelLinkInput}
						size="sm"
						type="button"
						variant="ghost"
					>
						<IconX size={16} />
					</Button>
				</div>
			)}

			<div className="min-h-[120px] rounded-md border p-3 focus-within:ring-2 focus-within:ring-ring">
				<EditorContent
					className="prose prose-sm dark:prose-invert max-w-none [&_.tiptap]:outline-none [&_.tiptap_*:first-child]:mt-0 [&_.tiptap_blockquote]:my-1 [&_.tiptap_h2]:mt-4 [&_.tiptap_h2]:mb-1 [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:text-lg [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:mb-1 [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:text-base [&_.tiptap_li]:my-0 [&_.tiptap_li_p]:my-0 [&_.tiptap_ol]:my-1 [&_.tiptap_ol]:pl-5 [&_.tiptap_p]:my-1 [&_.tiptap_ul]:my-1 [&_.tiptap_ul]:pl-5"
					editor={editor}
				/>
			</div>
		</div>
	);
}

function ToolbarButton({
	active,
	children,
	label,
	onClick,
}: {
	active: boolean;
	children: React.ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<Button
			aria-label={label}
			aria-pressed={active}
			onClick={onClick}
			size="sm"
			type="button"
			variant={active ? "secondary" : "ghost"}
		>
			{children}
		</Button>
	);
}
