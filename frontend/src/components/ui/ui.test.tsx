import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecisionBadge, ForbiddenState, RiskBadge, SimulatedTag } from "./index";

describe("security primitives", () => {
  it("renders decision and risk language", () => {
    render(
      <>
        <DecisionBadge decision="CHALLENGE" />
        <RiskBadge score={82} />
      </>,
    );
    expect(screen.getByText("CHALLENGE")).toBeInTheDocument();
    expect(screen.getByText(/82/)).toBeInTheDocument();
    expect(screen.getByText(/CRITICAL/)).toBeInTheDocument();
  });

  it("labels simulated data accessibly", () => {
    render(<SimulatedTag />);
    expect(screen.getByTitle("Synthetic demo data")).toHaveTextContent("Simulated");
  });

  it("explains least-privilege enforcement without leaking data", () => {
    render(<ForbiddenState />);
    expect(screen.getByRole("heading", { name: "Access boundary enforced" })).toBeInTheDocument();
  });
});
