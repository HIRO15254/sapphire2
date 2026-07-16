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
	routeTree,
	defaultPreload: "intent",
	defaultPendingComponent: () => <Loader />,
	context: { trpc, queryClient },
	defaultErrorComponent: RouterErrorFallback,
	defaultNotFoundComponent: RouterNotFoundFallback,
	Wrap({ children }: { children: React.ReactNode }) {
		return (
			<PersistQueryClientProvider
				client={queryClient}
				persistOptions={{
					persister,
					maxAge: 1000 * 60 * 60 * 24,
					// Bump this string on any release whose server changes alter a
					// procedure's output shape or value semantics — deployed clients
					// otherwise rehydrate up to 24h of old-shaped cache into new code
					// (SA2-154). This release: migration 0039 changed variant value
					// semantics ('nlh' -> labels) and several outputs gained fields.
					buster: "2026-07-mix-games",
					dehydrateOptions: {
						shouldDehydrateQuery: shouldPersistQuery,
					},
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

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(<RouterProvider router={router} />);
}
