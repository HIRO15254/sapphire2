import { createFileRoute } from "@tanstack/react-router";
import { StoreDetailPage } from "@/features/stores/pages/store-detail-page";

export const Route = createFileRoute("/stores/$storeId")({
	component: StoreDetailRoute,
});

function StoreDetailRoute() {
	const { storeId } = Route.useParams();
	return <StoreDetailPage storeId={storeId} />;
}
