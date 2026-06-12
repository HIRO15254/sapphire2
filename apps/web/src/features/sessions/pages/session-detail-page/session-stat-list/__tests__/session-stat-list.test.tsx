import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionStatList } from "@/features/sessions/pages/session-detail-page/session-stat-list";

describe("SessionStatList", () => {
	it("renders the title and each row's label and value", () => {
		render(
			<SessionStatList
				rows={[
					{ label: "Buy-in", value: "10k" },
					{ label: "Cash-out", value: "13.5k" },
				]}
				title="Cash game"
			/>
		);
		expect(
			screen.getByRole("heading", { name: "Cash game" })
		).toBeInTheDocument();
		expect(screen.getByText("Buy-in")).toBeInTheDocument();
		expect(screen.getByText("10k")).toBeInTheDocument();
		expect(screen.getByText("Cash-out")).toBeInTheDocument();
		expect(screen.getByText("13.5k")).toBeInTheDocument();
	});

	it("renders nothing when there are no rows", () => {
		const { container } = render(
			<SessionStatList rows={[]} title="Cash game" />
		);
		expect(container).toBeEmptyDOMElement();
		expect(
			screen.queryByRole("heading", { name: "Cash game" })
		).not.toBeInTheDocument();
	});
});
