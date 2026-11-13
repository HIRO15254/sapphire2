import { createFileRoute } from "@tanstack/react-router";
import { CategoriesPage } from "@/features/assets/pages/categories-page";

export const Route = createFileRoute("/assets/categories")({
	component: CategoriesPage,
});
