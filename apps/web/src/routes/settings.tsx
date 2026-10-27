import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { SettingsPage } from "@/features/settings/pages/settings-page";

const settingsSearchSchema = z.object({
	linkError: z.enum(["google", "discord"]).optional().catch(undefined),
});

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
	validateSearch: settingsSearchSchema,
});
