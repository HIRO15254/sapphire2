import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { AssetDetailPage } from "@/features/assets/pages/asset-detail-page";

const assetSearchSchema = z.object({
	tab: z.enum(["history", "rates"]).optional().catch(undefined),
});

function AssetDetailRoute() {
	const { assetId } = Route.useParams();
	const { tab } = Route.useSearch();
	return <AssetDetailPage assetId={assetId} tab={tab ?? "history"} />;
}

export const Route = createFileRoute("/assets/$assetId")({
	component: AssetDetailRoute,
	validateSearch: assetSearchSchema,
});
