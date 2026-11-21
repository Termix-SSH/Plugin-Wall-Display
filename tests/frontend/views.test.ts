import { describe, expect, it } from "vitest";
import {
  activeViews,
  DEFAULT_INTERVAL,
  intervalSeconds,
  STATUS_TAB,
  step,
  WALL_VIEWS,
} from "../../src/frontend/views";

const all = new Set(WALL_VIEWS.map((view) => view.tabType));

describe("activeViews", () => {
  it("keeps the set order when everything is installed", () => {
    expect(activeViews(all, {}).map((view) => view.tabType)).toEqual([
      "homepage",
      "uptime",
      STATUS_TAB,
      "network_graph",
    ]);
  });

  it("skips views whose plugin is not installed", () => {
    expect(
      activeViews(new Set([STATUS_TAB]), {}).map((view) => view.tabType),
    ).toEqual([STATUS_TAB]);
  });

  it("skips views turned off in settings", () => {
    expect(
      activeViews(all, { showUptime: false, showHomepage: false }).map(
        (view) => view.tabType,
      ),
    ).toEqual([STATUS_TAB, "network_graph"]);
  });
});

describe("intervalSeconds", () => {
  it("falls back to the default for bad values", () => {
    expect(intervalSeconds(undefined)).toBe(DEFAULT_INTERVAL);
    expect(intervalSeconds("x")).toBe(DEFAULT_INTERVAL);
    expect(intervalSeconds(0)).toBe(DEFAULT_INTERVAL);
  });

  it("keeps values inside the allowed range", () => {
    expect(intervalSeconds(3)).toBe(10);
    expect(intervalSeconds(45.4)).toBe(45);
    expect(intervalSeconds(99999)).toBe(3600);
  });
});

describe("step", () => {
  it("wraps both ways", () => {
    expect(step(3, 4, 1)).toBe(0);
    expect(step(0, 4, -1)).toBe(3);
    expect(step(1, 4, 1)).toBe(2);
    expect(step(0, 0, 1)).toBe(0);
  });
});
