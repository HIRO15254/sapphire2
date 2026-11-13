import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen";
import Loader from "./shared/components/loader";
import {
	RouterErrorFallback,
	RouterNotFoundFallback,
} from "./shared/components/router-fallback";
import { shouldPersistQuery } from "./utils/query-persistence";
import { persister, queryClient, trpc } from "./utils/trpc";

const router = createRouter({
	context: { queryClient, trpc },
	defaultErrorComponent: RouterErrorFallback,
	defaultNotFoundComponent: RouterNotFoundFallback,
	defaultPendingComponent: () => <Loader />,
	defaultPreload: "intent",
	routeTree,
	Wrap({ children }: { children: React.ReactNode }) {
		return (
			<PersistQueryClientProvider
				client={queryClient}
				persistOptions={{
					// NOTE(ops): When a release changes any tRPC procedure's output shape or
					// value semantics, bump this buster string in the same change (SA2-154).
					buster: "2026-11-u03-assets",
					dehydrateOptions: {
						shouldDehydrateQuery: shouldPersistQuery,
					},
					maxAge: 1000 * 60 * 60 * 24,
					persister,
				}}
			>
				{children}
			</PersistQueryClientProvider>
		);
	},
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.querySelector("#app");

if (!rootElement) {
	throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(<RouterProvider router={router} />);
}
