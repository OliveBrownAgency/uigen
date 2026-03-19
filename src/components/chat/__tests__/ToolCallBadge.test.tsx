import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getToolLabel } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

describe("getToolLabel", () => {
  test("str_replace_editor create", () => {
    expect(getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" })).toBe("Creating /App.jsx");
  });

  test("str_replace_editor str_replace", () => {
    expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/components/Card.jsx" })).toBe("Editing /components/Card.jsx");
  });

  test("str_replace_editor insert", () => {
    expect(getToolLabel("str_replace_editor", { command: "insert", path: "/utils/helpers.ts" })).toBe("Editing /utils/helpers.ts");
  });

  test("str_replace_editor view", () => {
    expect(getToolLabel("str_replace_editor", { command: "view", path: "/App.jsx" })).toBe("Viewing /App.jsx");
  });

  test("str_replace_editor undo_edit", () => {
    expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })).toBe("Undoing edit in /App.jsx");
  });

  test("file_manager rename", () => {
    expect(getToolLabel("file_manager", { command: "rename", path: "/old.jsx", new_path: "/new.jsx" })).toBe("Renaming /old.jsx");
  });

  test("file_manager delete", () => {
    expect(getToolLabel("file_manager", { command: "delete", path: "/old.jsx" })).toBe("Deleting /old.jsx");
  });

  test("unknown tool falls back to tool name", () => {
    expect(getToolLabel("some_unknown_tool", {})).toBe("some_unknown_tool");
  });
});

describe("ToolCallBadge", () => {
  test("in-progress state shows spinner and label", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "str_replace_editor",
          args: { command: "create", path: "/App.jsx" },
          state: "call",
        }}
      />
    );
    expect(screen.getByText("Creating /App.jsx")).toBeDefined();
    // Green dot should not be present
    const badge = screen.getByText("Creating /App.jsx").closest("div");
    expect(badge?.querySelector(".bg-emerald-500")).toBeNull();
  });

  test("done state shows green dot and label", () => {
    render(
      <ToolCallBadge
        toolInvocation={{
          toolName: "str_replace_editor",
          args: { command: "str_replace", path: "/components/Card.jsx" },
          state: "result",
          result: "Success",
        }}
      />
    );
    expect(screen.getByText("Editing /components/Card.jsx")).toBeDefined();
    const badge = screen.getByText("Editing /components/Card.jsx").closest("div");
    expect(badge?.querySelector(".bg-emerald-500")).toBeDefined();
  });
});
