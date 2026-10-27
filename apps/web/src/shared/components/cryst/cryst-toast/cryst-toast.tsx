import {
	IconAlertTriangle,
	IconArrowBackUp,
	IconCircleCheck,
	IconCircleX,
	IconInfoCircle,
	IconLoader2,
	IconTrash,
} from "@tabler/icons-react";
import { crystButton } from "../cryst-controls";

export type CrystToastKind =
	| "pending"
	| "success"
	| "undone"
	| "undo-error"
	| "error"
	| "deleted"
	| "info";

const icons = {
	pending: IconLoader2,
	success: IconCircleCheck,
	undone: IconArrowBackUp,
	"undo-error": IconAlertTriangle,
	error: IconCircleX,
	deleted: IconTrash,
	info: IconInfoCircle,
};

const colors = {
	pending: "text-muted-foreground animate-spin",
	success: "text-[var(--success-text)]",
	undone: "text-muted-foreground",
	"undo-error": "text-[var(--warning-text)]",
	error: "text-[var(--danger-text)]",
	deleted: "text-muted-foreground",
	info: "text-muted-foreground",
};

export function CrystToast({
	kind,
	title,
	description,
	onUndo,
}: {
	kind: CrystToastKind;
	title: string;
	description?: string;
	onUndo?: () => void;
}) {
	const Icon = icons[kind];
	return (
		<div
			className="flex w-[min(360px,calc(100vw-32px))] items-center gap-2.5 rounded-lg border border-border bg-popover py-3 pr-3 pl-3.5 text-foreground shadow-[var(--shadow-lg)]"
			role={kind === "error" || kind === "undo-error" ? "alert" : "status"}
		>
			<Icon aria-hidden="true" className={`size-4 shrink-0 ${colors[kind]}`} />
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm leading-[1.4]">{title}</p>
				{description && (
					<p className="mt-0.5 text-muted-foreground text-xs leading-[1.4]">
						{description}
					</p>
				)}
			</div>
			{onUndo && (
				<button
					className={crystButton({ variant: "ghost", size: "sm" })}
					onClick={onUndo}
					type="button"
				>
					<IconArrowBackUp aria-hidden="true" size={14} />
					Undo
				</button>
			)}
		</div>
	);
}
