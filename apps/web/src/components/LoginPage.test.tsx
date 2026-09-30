import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("renders a product login with demo roles", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "HarborWatch 3D" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operator" })).toBeInTheDocument();
    expect(screen.getByText("Cedar Inlet")).toBeInTheDocument();
  });
});
