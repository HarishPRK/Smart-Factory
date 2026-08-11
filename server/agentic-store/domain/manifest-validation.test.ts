// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createSensorBindings, createStoreManifest } from "./store-catalog.js";
import {
  StoreConfigurationError,
  validateStoreConfiguration,
} from "./manifest-validation.js";

describe("validateStoreConfiguration", () => {
  it("accepts the default manifest and its simulator bindings", () => {
    expect(() =>
      validateStoreConfiguration(createStoreManifest(), createSensorBindings()),
    ).not.toThrow();
  });

  it("rejects duplicate scene nodes before a renderer receives an ambiguous mapping", () => {
    const manifest = structuredClone(createStoreManifest());
    manifest.entities[1].sceneNodeId = manifest.entities[0].sceneNodeId;

    expect(() => validateStoreConfiguration(manifest, createSensorBindings())).toThrow(
      new StoreConfigurationError("Duplicate scene node id: store-root"),
    );
  });

  it("rejects dangling hierarchy references", () => {
    const manifest = structuredClone(createStoreManifest());
    manifest.entities[1].parentId = "missing-store";

    expect(() => validateStoreConfiguration(manifest, createSensorBindings())).toThrow(
      /references missing parent missing-store/,
    );
  });

  it("rejects a sensor binding that targets an undeclared twin property", () => {
    const bindings = structuredClone(createSensorBindings());
    bindings[0].property = "occupancy.notDeclared";

    expect(() => validateStoreConfiguration(createStoreManifest(), bindings)).toThrow(
      /references unknown property store-001\.occupancy\.notDeclared/,
    );
  });

  it("rejects two sensor sources claiming the same semantic property", () => {
    const bindings = structuredClone(createSensorBindings());
    bindings.push({
      ...bindings[0],
      id: "plc-occupancy-owner",
      sourceId: "plc:store-001",
      tag: "STORE_OCCUPANCY",
    });

    expect(() => validateStoreConfiguration(createStoreManifest(), bindings)).toThrow(
      /Multiple bindings claim semantic property store-001\.occupancy\.count/,
    );
  });
});
