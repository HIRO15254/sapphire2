import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTagNameForm } from "@/shared/components/management/tag-name-form/use-tag-name-form";

type FormOf = ReturnType<typeof useTagNameForm>["form"];

function nameErrorMessages(form: FormOf): (string | undefined)[] {
	const errors = (form.getFieldMeta("name")?.errors ?? []) as {
		message?: string;
	}[];
	return errors.map((e) => e?.message);
}

describe("useTagNameForm", () => {
	it("starts with empty name when defaultName is not provided", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		expect(result.current.form.state.values).toEqual({ name: "" });
	});

	it("seeds the form with defaultName", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTagNameForm({ onSubmit, defaultName: "Existing" })
		);
		expect(result.current.form.state.values).toEqual({ name: "Existing" });
	});

	it("rejects empty name on submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
		expect(nameErrorMessages(result.current.form)).toContain(
			"Tag name is required"
		);
	});

	it.each([
		["   "],
		["\t\n "],
	])("rejects a whitespace-only name %j with the required message", async (whitespace) => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", whitespace);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
		expect(nameErrorMessages(result.current.form)).toContain(
			"Tag name is required"
		);
	});

	it("submits a padded name trimmed", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", " Foo ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith("Foo");
	});

	it("accepts 50 characters wrapped in whitespace (length is measured trimmed)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", `  ${"x".repeat(50)}  `);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith("x".repeat(50));
	});

	it.each([
		[`  ${"x".repeat(51)}  `],
		["x".repeat(51)],
	])("rejects 51+ characters %j", async (name) => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", name);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
		expect(nameErrorMessages(result.current.form)).toContain(
			"Tag name must be 50 characters or less"
		);
	});

	it("accepts name at exactly 50 characters", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "x".repeat(50));
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith("x".repeat(50));
	});

	it("calls onSubmit with the current name on valid submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "VIP");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith("VIP");
	});

	it("does not reset the form after submit (caller decides)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("name", "VIP");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(result.current.form.state.values.name).toBe("VIP");
	});

	it("defaults label to 'Tag name' when omitted", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTagNameForm({ onSubmit }));
		expect(result.current.label).toBe("Tag name");
	});

	it("overrides label when provided", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTagNameForm({ onSubmit, label: "Preset name" })
		);
		expect(result.current.label).toBe("Preset name");
	});
});

describe("validation copy follows the label", () => {
	it("names the default label when none is given", async () => {
		const { result } = renderHook(() => useTagNameForm({ onSubmit: vi.fn() }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(nameErrorMessages(result.current.form)).toContain(
			"Tag name is required"
		);
	});

	it("names an overridden label in the required message", async () => {
		const { result } = renderHook(() =>
			useTagNameForm({ label: "Preset name", onSubmit: vi.fn() })
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(nameErrorMessages(result.current.form)).toContain(
			"Preset name is required"
		);
	});

	it("names an overridden label in the max-length message", async () => {
		const { result } = renderHook(() =>
			useTagNameForm({ label: "Preset name", onSubmit: vi.fn() })
		);
		await act(async () => {
			result.current.form.setFieldValue("name", "x".repeat(51));
			await result.current.form.handleSubmit();
		});
		expect(nameErrorMessages(result.current.form)).toContain(
			"Preset name must be 50 characters or less"
		);
	});
});
