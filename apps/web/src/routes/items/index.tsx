import { createFileRoute } from "@tanstack/react-router";
import { ItemsPage } from "@/features/items/pages/items-page";

export const Route = createFileRoute("/items/")({
	component: ItemsPage,
});
