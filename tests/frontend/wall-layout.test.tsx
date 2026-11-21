import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

const state = vi.hoisted(() => ({
  types: [] as string[],
  values: {} as Record<string, unknown>,
  active: undefined as string | undefined,
  opened: [] as string[],
  toggle: () => {},
  logout: (_options?: { manual?: boolean }) => {},
}));

vi.mock("@termix-ssh/plugin-sdk/frontend", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
    language: "en",
  }),
  useShell: () => ({
    registries: { useTabTypes: () => state.types.map((id) => ({ id })) },
  }),
  useSettings: () => ({
    values: state.values,
    loaded: true,
    save: async () => {},
  }),
}));

vi.mock("@termix-ssh/plugin-sdk/ui", async () => {
  const React = await import("react");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    cn: (...parts: unknown[]) => parts.filter(Boolean).join(" "),
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuItem: ({
      children,
      onSelect,
    }: {
      children?: React.ReactNode;
      onSelect?: () => void;
    }) => React.createElement("button", { onClick: onSelect }, children),
    getTabType: (id: string) => ({ id, titleKey: `title.${id}` }),
    ShellConfirmCapture: () => null,
    SurfaceScope: Pass,
    TabStage: () =>
      React.createElement("div", { "data-testid": "stage" }, state.active),
    useShellController: () => {
      const [, rerender] = React.useReducer((n: number) => n + 1, 0);
      const open = React.useCallback((type: string) => {
        state.opened.push(type);
        state.active = type;
        rerender();
        return type;
      }, []);
      return {
        username: "wall",
        tabs: {
          ready: true,
          active: state.active ? { type: state.active } : undefined,
          openSingleton: open,
        },
        fullscreen: { active: false, toggle: state.toggle },
        logout: state.logout,
      };
    },
  };
});

import { WallLayout } from "../../src/frontend/WallLayout";

beforeEach(() => {
  vi.useFakeTimers();
  state.types = ["homepage", "uptime", "status-board", "network_graph"];
  state.values = { intervalSeconds: 10 };
  state.active = undefined;
  state.opened = [];
  state.toggle = vi.fn();
  state.logout = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("WallLayout", () => {
  it("opens the first view and moves on after the interval", () => {
    render(<WallLayout />);
    expect(state.active).toBe("homepage");
    advance(10_000);
    expect(state.active).toBe("uptime");
    advance(10_000);
    expect(state.active).toBe("status-board");
    advance(10_000);
    expect(state.active).toBe("network_graph");
    advance(10_000);
    expect(state.active).toBe("homepage");
  });

  it("skips views that are not installed or turned off", () => {
    state.types = ["uptime", "status-board", "network_graph"];
    state.values = { intervalSeconds: 10, showTopology: false };
    render(<WallLayout />);
    expect(state.active).toBe("uptime");
    advance(10_000);
    expect(state.active).toBe("status-board");
    advance(10_000);
    expect(state.active).toBe("uptime");
    expect(state.opened).not.toContain("network_graph");
  });

  it("pauses and steps with the keyboard", () => {
    render(<WallLayout />);
    fireEvent.keyDown(window, { key: " " });
    advance(60_000);
    expect(state.active).toBe("homepage");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(state.active).toBe("uptime");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(state.active).toBe("network_graph");
    fireEvent.keyDown(window, { key: "f" });
    expect(state.toggle).toHaveBeenCalledOnce();
  });

  it("shows the controls on mouse move and hides them again", () => {
    render(<WallLayout />);
    const toolbar = screen.getByRole("toolbar", { hidden: true });
    expect(toolbar.getAttribute("aria-hidden")).toBe("true");
    fireEvent.mouseMove(screen.getByTestId("wall-cover"));
    expect(toolbar.getAttribute("aria-hidden")).toBe("false");
    expect(toolbar.textContent).toContain("title.homepage");
    advance(3000);
    expect(toolbar.getAttribute("aria-hidden")).toBe("true");
  });

  it("buttons step, pause and sign out", () => {
    render(<WallLayout />);
    fireEvent.click(screen.getByLabelText("wall.next"));
    expect(state.active).toBe("uptime");
    fireEvent.click(screen.getByLabelText("wall.pause"));
    expect(screen.getByLabelText("wall.resume")).toBeTruthy();
    advance(60_000);
    expect(state.active).toBe("uptime");
    fireEvent.click(screen.getByText("wall.logout"));
    expect(state.logout).toHaveBeenCalledWith({ manual: true });
  });

  it("puts the view back when another tab takes the stage", () => {
    const { rerender } = render(<WallLayout />);
    state.active = "settings";
    rerender(<WallLayout />);
    expect(state.active).toBe("homepage");
  });

  it("explains itself when there is nothing to show", () => {
    state.types = [];
    render(<WallLayout />);
    expect(screen.getByText("wall.noViews")).toBeTruthy();
    expect(screen.queryByTestId("stage")).toBeNull();
    expect(state.opened).toEqual([]);
  });

  it("shows one view without a timer or progress bar", () => {
    state.types = ["status-board"];
    render(<WallLayout />);
    advance(60_000);
    expect(state.opened).toEqual(["status-board"]);
    expect(screen.queryByTestId("wall-progress")).toBeNull();
  });
});
