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
import { Input } from "@/shared/components/ui/input";
import { Separator } from "@/shared/components/ui/separator";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import { useRichTextEditor } from "./use-rich-text-editor";

interface RichTextEditorProps {
	initialContent?: string | null;
	onChange: (html: string) => void;
}

const TOGGLE_ITEM_CLASS = "size-[var(--h-control-sm)] px-0";

export function RichTextEditor({
	initialContent,
	onChange,
}: RichTextEditorProps) {
	const {
		activeFormats,
		applyLink,
		cancelLinkInput,
		editor,
		linkUrl,
		onFormatsChange,
		onLinkUrlChange,
		openLinkInput,
		removeLink,
		showLinkInput,
	} = useRichTextEditor({ initialContent, onChange });

	if (!editor) {
		return null;
	}

	const linkActive = editor.isActive("link");

	return (
		<div className="w-full rounded-lg border border-input bg-transparent text-base outline-none transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30">
			<div className="flex flex-wrap items-center gap-1 border-input border-b p-1.5">
				<ToggleGroup
					className="flex-wrap gap-1"
					onValueChange={onFormatsChange}
					type="multiple"
					value={activeFormats}
				>
					<ToggleGroupItem
						aria-label="Bold"
						className={TOGGLE_ITEM_CLASS}
						value="bold"
					>
						<IconBold size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem
						aria-label="Italic"
						className={TOGGLE_ITEM_CLASS}
						value="italic"
					>
						<IconItalic size={16} />
					</ToggleGroupItem>
					<Separator className="mx-0.5 h-5" orientation="vertical" />
					<ToggleGroupItem
						aria-label="Heading 2"
						className={TOGGLE_ITEM_CLASS}
						value="h2"
					>
						<IconH2 size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem
						aria-label="Heading 3"
						className={TOGGLE_ITEM_CLASS}
						value="h3"
					>
						<IconH3 size={16} />
					</ToggleGroupItem>
					<Separator className="mx-0.5 h-5" orientation="vertical" />
					<ToggleGroupItem
						aria-label="Bullet list"
						className={TOGGLE_ITEM_CLASS}
						value="bulletList"
					>
						<IconList size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem
						aria-label="Ordered list"
						className={TOGGLE_ITEM_CLASS}
						value="orderedList"
					>
						<IconListNumbers size={16} />
					</ToggleGroupItem>
				</ToggleGroup>
				<Separator className="mx-0.5 h-5" orientation="vertical" />
				<Button
					aria-label="Link"
					aria-pressed={linkActive}
					onClick={openLinkInput}
					size="icon-sm"
					type="button"
					variant={linkActive ? "secondary" : "ghost"}
				>
					<IconLink size={16} />
				</Button>
			</div>

			{showLinkInput && (
				<div className="flex items-center gap-1 border-input border-b p-2">
					<Input
						autoFocus
						className="h-[var(--h-control-sm)] flex-1"
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
						type="url"
						value={linkUrl}
					/>
					<Button
						aria-label="Apply link"
						onClick={applyLink}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<IconCheck size={16} />
					</Button>
					{linkActive && (
						<Button
							aria-label="Remove link"
							onClick={removeLink}
							size="icon-sm"
							type="button"
							variant="ghost"
						>
							<IconLinkOff size={16} />
						</Button>
					)}
					<Button
						aria-label="Cancel"
						onClick={cancelLinkInput}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<IconX size={16} />
					</Button>
				</div>
			)}

			<EditorContent
				className="prose prose-sm dark:prose-invert max-w-none [&_.tiptap]:min-h-[120px] [&_.tiptap]:px-3 [&_.tiptap]:py-2 [&_.tiptap]:outline-none [&_.tiptap_*:first-child]:mt-0 [&_.tiptap_blockquote]:my-1 [&_.tiptap_h2]:mt-4 [&_.tiptap_h2]:mb-1 [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:text-lg [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:mb-1 [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:text-base [&_.tiptap_li]:my-0 [&_.tiptap_li_p]:my-0 [&_.tiptap_ol]:my-1 [&_.tiptap_ol]:pl-5 [&_.tiptap_p]:my-1 [&_.tiptap_ul]:my-1 [&_.tiptap_ul]:pl-5"
				editor={editor}
			/>
		</div>
	);
}
