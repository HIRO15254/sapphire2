import { createFileRoute } from "@tanstack/react-router";
import { AssetsPage } from "@/features/assets/pages/assets-page";

export const Route = createFileRoute("/assets/")({ component: AssetsPage });
