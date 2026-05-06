import { createFileRoute } from "@tanstack/react-router";
import { useHomePage } from "./-use-home-page";

export const Route = createFileRoute("/")({
	component: HomeRedirect,
});

function HomeRedirect() {
	useHomePage();
	return null;
}
