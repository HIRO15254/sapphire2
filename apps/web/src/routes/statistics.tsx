import { createFileRoute } from "@tanstack/react-router";
import { StatisticsPage } from "@/features/statistics/pages/statistics-page";
import { statsSearchSchema } from "@/features/statistics/utils/stats-filters";

export const Route = createFileRoute("/statistics")({
	validateSearch: statsSearchSchema,
	component: StatisticsPage,
});
