import { createFileRoute } from "@tanstack/react-router";
import { useHomePage } from "./-use-home-page";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	useHomePage();
	return null;
}
