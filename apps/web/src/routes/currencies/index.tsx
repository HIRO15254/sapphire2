import { createFileRoute } from "@tanstack/react-router";
import { CurrenciesPage } from "@/features/currencies/v2/pages/currencies-page";

export const Route = createFileRoute("/currencies/")({
	component: CurrenciesPage,
});
