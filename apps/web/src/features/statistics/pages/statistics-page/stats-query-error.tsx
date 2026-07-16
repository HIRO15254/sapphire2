import { QueryError } from "@/shared/components/query-error";

export function StatsQueryError({ onRetry }: { onRetry: () => void }) {
	return <QueryError message="Unable to load statistics" onRetry={onRetry} />;
}
