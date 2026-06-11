import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "@/features/search/pages/search-page";

export const Route = createFileRoute("/search")({
	component: SearchPage,
});
