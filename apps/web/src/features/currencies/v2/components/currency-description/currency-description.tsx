import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { RichTextContent } from "@/shared/components/ui/rich-text-content";
import { useCurrencyDescription } from "./use-currency-description";

interface CurrencyDescriptionProps {
	html: string;
}

export function CurrencyDescription({ html }: CurrencyDescriptionProps) {
	const { collapsedMaxPx, contentRef, isExpanded, isOverflowing, toggle } =
		useCurrencyDescription();
	const showFade = isOverflowing && !isExpanded;

	return (
		<section className="mb-6 rounded-lg border border-border bg-card text-card-foreground">
			<h2 className="t-h4 border-border border-b px-4 py-3">Description</h2>
			<div className="relative">
				<div
					className="overflow-hidden"
					data-testid="currency-description-body"
					ref={contentRef}
					style={{ maxHeight: isExpanded ? undefined : collapsedMaxPx }}
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
