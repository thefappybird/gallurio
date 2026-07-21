import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi, beforeEach } from "vitest";
import enMessages from "@/messages/en.json";
import { BookDemoForm } from "./BookDemoForm";

const submitBookDemoAction = vi.fn();
vi.mock("../_actions", () => ({
  submitBookDemoAction: (input: unknown) => submitBookDemoAction(input),
}));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BookDemoForm />
    </NextIntlClientProvider>
  );
}

describe("BookDemoForm", () => {
  beforeEach(() => {
    submitBookDemoAction.mockReset();
  });

  it("blocks submission and shows validation errors when required fields are empty", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /request a demo/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(submitBookDemoAction).not.toHaveBeenCalled();
  });

  it("replaces the form with a success message after a successful submit", async () => {
    submitBookDemoAction.mockResolvedValue({ ok: true });
    renderForm();

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Alex Morgan" } });
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/business \/ studio name/i), { target: { value: "Aurora Studio" } });
    fireEvent.change(screen.getByLabelText(/what would you like to see/i), {
      target: { value: "The gallery block please." },
    });
    fireEvent.click(screen.getByRole("button", { name: /request a demo/i }));

    await waitFor(() => {
      expect(screen.getByText("Request received")).toBeInTheDocument();
    });
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /request a demo/i })).not.toBeInTheDocument();
  });

  it("shows a rate-limit error inline and keeps the form editable for resubmission", async () => {
    submitBookDemoAction.mockResolvedValue({ ok: false, error: "rate_limited" });
    renderForm();

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Alex Morgan" } });
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/business \/ studio name/i), { target: { value: "Aurora Studio" } });
    fireEvent.change(screen.getByLabelText(/what would you like to see/i), {
      target: { value: "The gallery block please." },
    });
    fireEvent.click(screen.getByRole("button", { name: /request a demo/i }));

    await waitFor(() => {
      expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
    });
    // Form stays editable — the name field the visitor typed is still there.
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Alex Morgan");
    expect(screen.getByRole("button", { name: /request a demo/i })).toBeEnabled();
  });

  it("disables the submit button while the request is pending", async () => {
    let resolveSubmit: (value: { ok: true }) => void = () => {};
    submitBookDemoAction.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );
    renderForm();

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Alex Morgan" } });
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText(/business \/ studio name/i), { target: { value: "Aurora Studio" } });
    fireEvent.change(screen.getByLabelText(/what would you like to see/i), {
      target: { value: "The gallery block please." },
    });
    fireEvent.click(screen.getByRole("button", { name: /request a demo/i }));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });

    resolveSubmit({ ok: true });
    await waitFor(() => {
      expect(screen.getByText("Request received")).toBeInTheDocument();
    });
  });
});
