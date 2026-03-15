import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SimplifiedDashboard from "../pages/SimplifiedDashboard";

describe("SimplifiedDashboard tabs", () => {
  it("renders Home, Plan, and History without crashing", () => {
    render(<SimplifiedDashboard />);

    expect(screen.getByText("QUIETLY IN CONTROL")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Plan" }).at(-1)!);
    expect(screen.getByText("TOMORROW")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "History" }).at(-1)!);
    expect(screen.getByText("PROVEN THIS WEEK")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Home" }).at(-1)!);
    expect(screen.getByText("QUIETLY IN CONTROL")).toBeInTheDocument();
  });
});
