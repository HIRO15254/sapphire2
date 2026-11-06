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

export function trpcHttpHandler(baseUrl: string, router: AnyTRPCRouter) {
	return http.all(`${baseUrl}/trpc/*`, ({ request }) =>
		fetchRequestHandler({
			createContext: () => ({}),
			endpoint: "/trpc",
			req: request as unknown as Parameters<
				typeof fetchRequestHandler
			>[0]["req"],
			router,
		})
	);
}

export function renderIntegrationPage(
	page: ReactElement,
	options: { path: string; queryClient: QueryClient }
) {
	const rootRoute = createRootRoute({ component: Outlet });
	const pageRoute = createRoute({
		component: () => page,
		getParentRoute: () => rootRoute,
		path: options.path,
	});
	const router = createRouter({
		defaultPreload: false,
		history: createMemoryHistory({ initialEntries: [options.path] }),
		routeTree: rootRoute.addChildren([pageRoute]),
	});

	return render(
		<QueryClientProvider client={options.queryClient}>
			<style>{"* { animation-name: none !important; }"}</style>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}
