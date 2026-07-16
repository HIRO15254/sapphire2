import { createFileRoute } from "@tanstack/react-router";
import { ItemDetailPage } from "@/features/items/pages/item-detail-page";

export const Route = createFileRoute("/items/$itemId")({
	component: ItemDetailRoute,
});

function ItemDetailRoute() {
	const { itemId } = Route.useParams();
	return <ItemDetailPage itemId={itemId} />;
}
