import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import Loader from "./shared/components/loader";
import { routeTree } from "./routeTree.gen";
import { persister, queryClient, trpc } from "./utils/trpc";

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	defaultPendingComponent: () => <Loader />,
	context: { trpc, queryClient },
	Wrap({ children }: { children: React.ReactNode }) {
		return (
			<PersistQueryClientProvider
				client={queryClient}
				persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
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
