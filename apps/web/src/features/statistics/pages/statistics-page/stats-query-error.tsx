import { Button } from "@/shared/components/ui/button";

export function StatsQueryError({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 p-4 text-center">
			<p className="text-destructive text-sm" role="alert">
				Unable to load statistics
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
