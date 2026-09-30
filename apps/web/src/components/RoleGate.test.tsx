import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleGate } from "../components/RoleGate";

describe("RoleGate", () => {
  it("hides operator actions from viewers", () => {
    render(
      <RoleGate role="viewer" allow={["operator", "admin"]}>
        <button>Ack</button>
      </RoleGate>,
    );
    expect(screen.queryByText("Ack")).toBeNull();
  });

  it("shows operator actions to operators", () => {
    render(
      <RoleGate role="operator" allow={["operator", "admin"]}>
        <button>Ack</button>
      </RoleGate>,
    );
    expect(screen.getByText("Ack")).toBeInTheDocument();
  });
});
