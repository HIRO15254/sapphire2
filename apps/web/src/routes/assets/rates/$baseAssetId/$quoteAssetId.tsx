import { createFileRoute } from "@tanstack/react-router";
import { RatePairPage } from "@/features/assets/pages/rate-pair-page";

function RatePairRoute() {
	const { baseAssetId, quoteAssetId } = Route.useParams();
	return <RatePairPage baseAssetId={baseAssetId} quoteAssetId={quoteAssetId} />;
}

export const Route = createFileRoute(
	"/assets/rates/$baseAssetId/$quoteAssetId"
)({ component: RatePairRoute });
