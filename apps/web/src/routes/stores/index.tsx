import { createFileRoute } from "@tanstack/react-router";
import { StoresPage } from "@/features/stores/pages/stores-page";

export const Route = createFileRoute("/stores/")({
	component: StoresPage,
});
