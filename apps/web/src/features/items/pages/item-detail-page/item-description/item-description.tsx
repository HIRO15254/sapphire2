import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { RichTextContent } from "@/shared/components/ui/rich-text-content";
import { useItemDescription } from "./use-item-description";

interface ItemDescriptionProps {
	html: string;
}

export function ItemDescription({ html }: ItemDescriptionProps) {
	const { contentRef, isExpanded, isOverflowing, maxHeight, toggle } =
		useItemDescription();
	const showFade = isOverflowing && !isExpanded;

	return (
		<section className="mb-6 rounded-lg border border-border bg-card text-card-foreground">
			<h2 className="t-h4 border-border border-b px-4 py-3">Description</h2>
			<div className="relative">
				<div
					className="overflow-hidden transition-[max-height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
					data-testid="item-description-body"
					ref={contentRef}
					style={{ maxHeight }}
				>
					<RichTextContent className="px-4 py-3 text-sm" html={html} />
				</div>
				{showFade ? (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent"
					/>
				) : null}
			</div>
			{isOverflowing ? (
				<div className="border-border border-t">
					<Button
						className="w-full justify-center gap-1 rounded-none rounded-b-lg text-muted-foreground"
						onClick={toggle}
						size="sm"
						type="button"
						variant="ghost"
					>
						{isExpanded ? (
							<>
								Show less
								<IconChevronUp size={16} />
							</>
						) : (
							<>
								Show more
								<IconChevronDown size={16} />
							</>
						)}
					</Button>
				</div>
			) : null}
		</section>
	);
}
