import { afterEach, describe, expect, it } from "vitest";
import {
  renderWithApp,
  type RenderedPluginApp,
} from "@termix-ssh/plugin-sdk/testing";
import { getRegisteredLayout } from "@termix-ssh/plugin-sdk/testing-host";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import * as plugin from "../../src/frontend/index";
import manifestJson from "../../manifest.json";
import locales from "../../locales/en.json";

const manifest = manifestJson as unknown as PluginManifest;

let rendered: RenderedPluginApp | null = null;

afterEach(async () => {
  await rendered?.deactivate();
  rendered = null;
});

describe(`${manifest.id} activate`, () => {
  it("registers the wall layout its manifest declares", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    const layout = getRegisteredLayout("wall");
    expect(layout).toMatchObject({ id: "wall", pluginId: manifest.id });
    expect(typeof layout?.component).toBe("function");
    expect(manifest.contributes?.layouts?.map((entry) => entry.id)).toEqual([
      "wall",
    ]);
  });

  it("registers the host status board tab", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    expect(rendered.registered.tabs()).toEqual(["status-board"]);
    expect(manifest.contributes?.tabs?.map((tab) => tab.id)).toEqual([
      "status-board",
    ]);
  });

  it("takes the layout back when it is turned off", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    await rendered.deactivate();
    rendered = null;
    expect(getRegisteredLayout("wall")).toBeUndefined();
  });

  it("is a layout plugin with a label for every setting", () => {
    expect(manifest.capabilities).toContain("ui:layout");
    const user = (manifest.contributes?.settings?.user ?? []) as Array<{
      key: string;
      labelKey?: string;
    }>;
    const flat = JSON.stringify(locales);
    for (const setting of user) {
      const last = setting.labelKey?.split(".").at(-2);
      expect(last).toBe(setting.key);
      expect(flat).toContain(`"${setting.key}"`);
    }
  });
});
