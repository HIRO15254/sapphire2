import {
	IconChevronDown,
	IconChevronUp,
	IconEdit,
	IconNote,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { ColorBadge } from "@/components/players/color-badge";
import { Button } from "@/components/ui/button";

const ALLOWED_TAGS = new Set([
	"P",
	"H2",
	"H3",
	"UL",
	"OL",
	"LI",
	"STRONG",
	"EM",
	"A",
	"BR",
	"BLOCKQUOTE",
]);

function sanitizeHtml(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const clean = (node: Node): void => {
		const children = Array.from(node.childNodes);
		for (const child of children) {
			if (child.nodeType === Node.ELEMENT_NODE) {
				const el = child as Element;
				if (!ALLOWED_TAGS.has(el.tagName)) {
					el.replaceWith(...Array.from(el.childNodes));
					continue;
				}
				const attrs = Array.from(el.attributes);
				for (const attr of attrs) {
					if (
						el.tagName === "A" &&
						(attr.name === "href" ||
							attr.name === "rel" ||
							attr.name === "target")
					) {
						continue;
					}
					el.removeAttribute(attr.name);
				}
				clean(el);
			}
		}
	};
	clean(doc.body);
	return doc.body.innerHTML;
}

function SafeHtml({ className, html }: { className?: string; html: string }) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (ref.current) {
			ref.current.innerHTML = sanitizeHtml(html);
		}
	}, [html]);

	return <div className={className} ref={ref} />;
}

interface PlayerCardProps {
	onDelete: (id: string) => void;
	onEdit: (player: PlayerCardProps["player"]) => void;
	player: {
		createdAt: string;
		id: string;
		memo: string | null;
		name: string;
		tags: Array<{ id: string; name: string; color: string }>;
		updatedAt: string;
		userId: string;
	};
}

export function PlayerCard({ player, onEdit, onDelete }: PlayerCardProps) {
	const [expanded, setExpanded] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	return (
		<div className="rounded-lg border bg-card">
			<div className="flex items-start gap-2 p-3">
				<div className="min-w-0 flex-1">
					<span className="font-medium text-sm">{player.name}</span>
					{player.tags.length > 0 && (
						<div className="mt-1 flex flex-wrap gap-1">
							{player.tags.map((tag) => (
								<ColorBadge color={tag.color} key={tag.id}>
									{tag.name}
								</ColorBadge>
							))}
						</div>
					)}
				</div>

				{player.memo && (
					<IconNote
						className="mt-0.5 shrink-0 text-muted-foreground"
						size={14}
					/>
				)}

				<Button
					aria-label={expanded ? "Collapse details" : "Expand details"}
					className="shrink-0 text-muted-foreground"
					onClick={() => {
						setExpanded((prev) => !prev);
						setConfirmingDelete(false);
					}}
					size="icon-xs"
					variant="ghost"
				>
					{expanded ? (
						<IconChevronUp size={16} />
					) : (
						<IconChevronDown size={16} />
					)}
				</Button>
			</div>

			<div
				className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
			>
				<div className="overflow-hidden">
					<div className="border-t px-3 py-2">
						{player.memo ? (
							<SafeHtml
								className="prose prose-sm dark:prose-invert max-w-none text-xs [&_*:first-child]:mt-0 [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:font-semibold [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-base [&_li]:my-0 [&_li_p]:my-0 [&_ol]:my-1 [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5"
								html={player.memo}
							/>
						) : (
							<p className="text-muted-foreground text-xs">No memo yet.</p>
						)}

						{confirmingDelete ? (
							<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
								<span className="text-destructive text-xs">
									Delete this player?
								</span>
								<Button
									aria-label="Confirm delete"
									className="text-destructive hover:text-destructive"
									onClick={() => {
										onDelete(player.id);
										setConfirmingDelete(false);
										setExpanded(false);
									}}
									size="xs"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
								<Button
									aria-label="Cancel delete"
									onClick={() => setConfirmingDelete(false)}
									size="xs"
									variant="ghost"
								>
									<IconX size={14} />
									Cancel
								</Button>
							</div>
						) : (
							<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
								<Button
									onClick={() => onEdit(player)}
									size="xs"
									variant="ghost"
								>
									<IconEdit size={14} />
									Edit
								</Button>
								<Button
									className="text-destructive hover:text-destructive"
									onClick={() => setConfirmingDelete(true)}
									size="xs"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
