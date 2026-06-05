import { createFileRoute } from "@tanstack/react-router";
import { CurrenciesPage } from "@/features/currencies/pages/currencies-page";

export const Route = createFileRoute("/currencies/")({
	component: CurrenciesPage,
});
