import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";

export function SectionLoadError({
	isRetrying,
	message,
	onRetry,
}: {
	isRetrying: boolean;
	message: string;
	onRetry: () => void;
}) {
	return (
		<div
			className="flex items-center gap-2.5 rounded-xl border border-border bg-muted px-3 py-2.5"
			role="alert"
		>
			<IconAlertCircle aria-hidden className="size-5 text-destructive-text" />
			<span className="flex-1 leading-[1.4]">{message}</span>
			<Button
				aria-busy={isRetrying}
				disabled={isRetrying}
				onClick={onRetry}
				size="sm"
				type="button"
				variant="outline"
			>
				<IconRefresh aria-hidden />
				Retry
			</Button>
		</div>
	);
}
