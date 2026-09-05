import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { AnyTRPCRouter } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { http } from "msw";
import type { ReactElement } from "react";

/** Use tRPC's serializer and batch handling instead of copying its wire format. */
export function trpcHttpHandler(baseUrl: string, router: AnyTRPCRouter) {
	return http.all(`${baseUrl}/trpc/*`, ({ request }) =>
		fetchRequestHandler({
			endpoint: "/trpc",
			req: request,
			router,
			createContext: () => ({}),
		})
	);
}

/** A page with its real router links, rendered in an isolated memory history. */
export function renderIntegrationPage(
	page: ReactElement,
	options: { path: string; queryClient: QueryClient }
) {
	const rootRoute = createRootRoute({ component: Outlet });
	const pageRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: options.path,
		component: () => page,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([pageRoute]),
		history: createMemoryHistory({ initialEntries: [options.path] }),
		defaultPreload: false,
	});

	return render(
		<QueryClientProvider client={options.queryClient}>
			{/* jsdom has no animation timeline. Radix Presence must see "none"
			    instead of waiting for an animationend event that cannot occur. */}
			<style>{"* { animation-name: none !important; }"}</style>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}
