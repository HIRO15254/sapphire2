import { lazy, Suspense } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useSessionResultChart } from "./use-session-result-chart";

const SessionResultChartImpl = lazy(
	() => import("./session-result-chart-impl")
);

interface SessionResultChartProps {
	enabled: boolean;
	liveSessionId: string;
	sessionType: "cash_game" | "tournament";
}

export function SessionResultChart({
	enabled,
	liveSessionId,
	sessionType,
}: SessionResultChartProps) {
	const { isEmpty, isLoading, points } = useSessionResultChart({
		enabled,
		liveSessionId,
		sessionType,
	});

	if (!enabled) {
		return null;
	}
	if (isLoading) {
		return <Skeleton className="h-40 w-full" />;
	}
	if (isEmpty) {
		return (
			<div className="flex h-40 items-center justify-center text-muted-foreground text-xs">
				Not enough data yet
			</div>
		);
	}
	return (
		<div className="h-40 w-full">
			<Suspense fallback={<Skeleton className="h-full w-full" />}>
				<SessionResultChartImpl points={points} sessionType={sessionType} />
			</Suspense>
		</div>
	);
}
