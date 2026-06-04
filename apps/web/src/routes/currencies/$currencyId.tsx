import { createFileRoute } from "@tanstack/react-router";
import { CurrencyDetailPage } from "@/features/currencies/v2/pages/currency-detail-page";

export const Route = createFileRoute("/currencies/$currencyId")({
	component: CurrencyDetailRoute,
});

function CurrencyDetailRoute() {
	const { currencyId } = Route.useParams();
	return <CurrencyDetailPage currencyId={currencyId} />;
}
