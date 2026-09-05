import type { AppRouter } from "@sapphire2/api/routers/index";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

export const trpcKeys = createTRPCOptionsProxy<AppRouter>({
	client: createTRPCClient<AppRouter>({ links: [] }),
	queryClient: new QueryClient(),
});
