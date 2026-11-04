import { createFileRoute } from "@tanstack/react-router";
import { MorePage } from "@/features/more/pages/more-page/more-page";

export const Route = createFileRoute("/more")({ component: MorePage });
