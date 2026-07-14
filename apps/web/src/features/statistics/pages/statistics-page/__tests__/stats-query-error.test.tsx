import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatsQueryError } from "../stats-query-error";

describe("StatsQueryError", () => {
	it("announces the failure and retries the failed statistics query", async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn();

		render(<StatsQueryError onRetry={onRetry} />);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Unable to load statistics"
		);
		await user.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(onRetry).toHaveBeenCalledWith();
	});
});
