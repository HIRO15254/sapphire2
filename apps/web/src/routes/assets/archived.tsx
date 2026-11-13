import { createFileRoute } from "@tanstack/react-router";
import { ArchivedAssetsPage } from "@/features/assets/pages/archived-assets-page";

export const Route = createFileRoute("/assets/archived")({
	component: ArchivedAssetsPage,
});
