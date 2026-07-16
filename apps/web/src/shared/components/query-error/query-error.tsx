import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";

interface QueryErrorProps {
	className?: string;
	message: string;
	onRetry: () => void;
}

export function QueryError({ className, message, onRetry }: QueryErrorProps) {
	return (
		<div
			className={cn(
				"flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 p-4 text-center",
				className
			)}
		>
			<p className="text-destructive text-sm" role="alert">
				{message}
			</p>
			<Button
				onClick={() => onRetry()}
				size="sm"
				type="button"
				variant="outline"
			>
				Retry
			</Button>
		</div>
	);
}
