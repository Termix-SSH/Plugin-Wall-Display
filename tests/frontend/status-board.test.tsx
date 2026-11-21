import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

type Status = "online" | "offline" | "unknown";

const state = vi.hoisted(() => ({
  hosts: [] as Array<Record<string, unknown>>,
  loaded: true,
  statuses: {} as Record<number, Status>,
}));

vi.mock("@termix-ssh/plugin-sdk/frontend", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key, language: "en" }),
}));

vi.mock("@termix-ssh/plugin-sdk/ui", () => ({
  cn: (...parts: unknown[]) => parts.filter(Boolean).join(" "),
  getLiveHostStatus: (id: number) => state.statuses[id] ?? "unknown",
  getStatusClasses: (status: string, _scheme: string, variant: string) =>
    `${variant}-${status}`,
  LoadingState: ({ label }: { label?: string }) => label ?? null,
  useHostStatus: (id: number, enabled: boolean) =>
    enabled ? (state.statuses[id] ?? "unknown") : null,
  useShellController: () => ({
    hosts: { list: state.hosts, loaded: state.loaded },
  }),
  useStatusColorScheme: () => "status",
}));

import {
  countStatuses,
  groupByFolder,
  StatusBoard,
} from "../../src/frontend/StatusBoard";

const host = (id: number, name: string, folder = "", extra = {}) =>
  ({ id: String(id), name, ip: `10.0.0.${id}`, folder, ...extra }) as never;

afterEach(cleanup);

describe("groupByFolder", () => {
  it("sorts folders by name with no folder last", () => {
    const groups = groupByFolder([
      host(1, "b", ""),
      host(2, "z", "Web"),
      host(3, "a", "Db"),
      host(4, "a", ""),
    ]);
    expect(groups.map((group) => group.folder)).toEqual(["Db", "Web", ""]);
    expect(groups[2].hosts.map((h: { name: string }) => h.name)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("countStatuses", () => {
  it("counts a missing status as unknown", () => {
    const hosts = [host(1, "a"), host(2, "b"), host(3, "c")];
    const read = (h: { id: string }) =>
      h.id === "1" ? "online" : h.id === "2" ? "offline" : null;
    expect(countStatuses(hosts, read as never)).toEqual({
      online: 1,
      offline: 1,
      unknown: 1,
    });
  });
});

describe("StatusBoard", () => {
  it("shows every host with its status and the totals", () => {
    state.loaded = true;
    state.hosts = [
      host(1, "web", "Prod"),
      host(2, "db", "Prod"),
      host(3, "nas", "", { statusCheckEnabled: false }),
    ];
    state.statuses = { 1: "online", 2: "offline", 3: "online" };
    const { container } = render(<StatusBoard />);
    expect(screen.getByText("web")).toBeTruthy();
    expect(screen.getByText("Prod")).toBeTruthy();
    expect(screen.getByText("board.noFolder")).toBeTruthy();
    const count = (status: string) =>
      container.querySelector(`[data-count="${status}"]`)?.textContent;
    expect(count("online")).toBe("1");
    expect(count("offline")).toBe("1");
    expect(count("unknown")).toBe("1");
    expect(
      container
        .querySelector('[data-status="unknown"]')
        ?.textContent?.includes("nas"),
    ).toBe(true);
  });

  it("says so when there are no hosts", () => {
    state.hosts = [];
    render(<StatusBoard />);
    expect(screen.getByText("board.noHosts")).toBeTruthy();
  });

  it("waits for the host list", () => {
    state.loaded = false;
    render(<StatusBoard />);
    expect(screen.getByText("board.loading")).toBeTruthy();
    state.loaded = true;
  });
});
