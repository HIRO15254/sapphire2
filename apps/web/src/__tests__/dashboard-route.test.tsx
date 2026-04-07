import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: { component: ComponentType }) => ({
		options,
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		data: { message: "Connected" },
		isLoading: false,
	}),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({
			data: { user: { name: "Hiro" } },
		}),
	},
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		privateData: {
			queryOptions: () => ({ queryKey: ["private-data"] }),
		},
	},
}));

let routeModule: typeof import("@/routes/dashboard");

describe("DashboardRoute", () => {
	beforeAll(async () => {
		routeModule = await import("@/routes/dashboard");
	});

	it("renders the page header and API status", () => {
		const Component = routeModule.Route.options.component as ComponentType;

		render(<Component />);

		expect(
			screen.getByRole("heading", { name: "Dashboard" })
		).toBeInTheDocument();
		expect(screen.getByText("Welcome Hiro")).toBeInTheDocument();
		expect(screen.getByText("API Status")).toBeInTheDocument();
		expect(screen.getByText("API: Connected")).toBeInTheDocument();
	});
});
