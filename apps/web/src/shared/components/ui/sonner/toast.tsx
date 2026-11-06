import {
	IconAlertTriangle,
	IconCircleCheck,
	IconCircleX,
	IconInfoCircle,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export const TOAST_CARD_CLASS =
	"flex w-[min(360px,calc(100vw-32px))] items-center gap-2.5 rounded-lg border border-border bg-popover py-3 pr-3 pl-3.5 text-foreground shadow-[var(--shadow-lg)]";

export type ToastVariant = "neutral" | "success" | "warning" | "destructive";

const VARIANT_ICONS = {
	destructive: <IconCircleX className="text-destructive-text size-4" />,
	neutral: <IconInfoCircle className="text-muted-foreground size-4" />,
	success: <IconCircleCheck className="text-success-text size-4" />,
	warning: <IconAlertTriangle className="text-warning-text size-4" />,
} satisfies Record<ToastVariant, ReactNode>;

export function Toast({
	action,
	description,
	icon,
	title,
	variant,
}: {
	action?: ReactNode;
	description?: string;
	icon?: ReactNode;
	title: string;
	variant: ToastVariant;
}) {
	return (
		<div
			className={TOAST_CARD_CLASS}
			data-slot="toast"
			role={
				variant === "warning" || variant === "destructive" ? "alert" : "status"
			}
		>
			<span aria-hidden className="flex shrink-0">
				{icon ?? VARIANT_ICONS[variant]}
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-sm leading-[1.4] font-medium">{title}</p>
				{description ? (
					<p className="text-muted-foreground mt-0.5 text-xs leading-[1.4]">
						{description}
					</p>
				) : (
					description
				)}
			</div>
			{action}
		</div>
	);
}
