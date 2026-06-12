import { cn } from "@/lib/utils";
import { useRichTextContent } from "./use-rich-text-content";

/**
 * Read-only renderer for HTML produced by `RichTextEditor`. Mirrors the
 * editor's `.tiptap` prose styling so saved content looks identical to what
 * was authored. Callers tweak size/spacing via `className` (e.g. `text-xs`).
 */
const BASE_PROSE =
	"prose prose-sm dark:prose-invert max-w-none [&_*:first-child]:mt-0 [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:font-semibold [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-base [&_li]:my-0 [&_li_p]:my-0 [&_ol]:my-1 [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5";

interface RichTextContentProps {
	className?: string;
	html: string;
}

export function RichTextContent({ className, html }: RichTextContentProps) {
	const { ref } = useRichTextContent(html);
	return <div className={cn(BASE_PROSE, className)} ref={ref} />;
}
