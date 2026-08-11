import type {
  SensorBinding,
  StoreManifest,
} from "../../../packages/agentic-store-contracts/src/index.js";

export class StoreConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreConfigurationError";
  }
}

export function validateStoreConfiguration(
  manifest: StoreManifest,
  bindings: SensorBinding[],
): void {
  const entityIds = new Set<string>();
  const sceneNodeIds = new Set<string>();
  const propertyKeys = new Map<string, Set<string>>();
  const propertyTypes = new Map<string, Map<string, string>>();
  const propertyUnits = new Map<string, Map<string, string | undefined>>();

  for (const entity of manifest.entities) {
    if (entity.storeId !== manifest.storeId) {
      throw new StoreConfigurationError(
        `Entity ${entity.id} belongs to ${entity.storeId}, expected ${manifest.storeId}.`,
      );
    }
    if (entityIds.has(entity.id)) {
      throw new StoreConfigurationError(`Duplicate entity id: ${entity.id}`);
    }
    if (sceneNodeIds.has(entity.sceneNodeId)) {
      throw new StoreConfigurationError(`Duplicate scene node id: ${entity.sceneNodeId}`);
    }
    entityIds.add(entity.id);
    sceneNodeIds.add(entity.sceneNodeId);

    const keys = new Set<string>();
    const types = new Map<string, string>();
    const units = new Map<string, string | undefined>();
    for (const property of entity.properties) {
      if (keys.has(property.key)) {
        throw new StoreConfigurationError(
          `Duplicate property ${property.key} on entity ${entity.id}.`,
        );
      }
      keys.add(property.key);
      types.set(property.key, property.valueType);
      units.set(property.key, property.unit);
    }
    propertyKeys.set(entity.id, keys);
    propertyTypes.set(entity.id, types);
    propertyUnits.set(entity.id, units);
  }

  for (const entity of manifest.entities) {
    if (entity.parentId && !entityIds.has(entity.parentId)) {
      throw new StoreConfigurationError(
        `Entity ${entity.id} references missing parent ${entity.parentId}.`,
      );
    }
    if (entity.zoneId && !entityIds.has(entity.zoneId)) {
      throw new StoreConfigurationError(
        `Entity ${entity.id} references missing zone ${entity.zoneId}.`,
      );
    }
  }

  const bindingIds = new Set<string>();
  const sourceTags = new Set<string>();
  const semanticTargets = new Set<string>();
  for (const binding of bindings) {
    if (binding.storeId !== manifest.storeId) {
      throw new StoreConfigurationError(
        `Binding ${binding.id} belongs to ${binding.storeId}, expected ${manifest.storeId}.`,
      );
    }
    if (binding.min != null && binding.max != null && binding.min > binding.max) {
      throw new StoreConfigurationError(
        `Binding ${binding.id} has min greater than max.`,
      );
    }
    if (binding.staleAfterMs != null && binding.staleAfterMs < 1_000) {
      throw new StoreConfigurationError(
        `Binding ${binding.id} has staleAfterMs below 1000.`,
      );
    }
    if (binding.maxSampleAgeMs != null && binding.maxSampleAgeMs < 1_000) {
      throw new StoreConfigurationError(
        `Binding ${binding.id} has maxSampleAgeMs below 1000.`,
      );
    }
    if (bindingIds.has(binding.id)) {
      throw new StoreConfigurationError(`Duplicate sensor binding id: ${binding.id}`);
    }
    bindingIds.add(binding.id);

    const sourceTag = `${binding.sourceId}\u0000${binding.tag}`;
    if (sourceTags.has(sourceTag)) {
      throw new StoreConfigurationError(
        `Duplicate source/tag binding: ${binding.sourceId} / ${binding.tag}`,
      );
    }
    sourceTags.add(sourceTag);

    const semanticTarget = `${binding.entityId}\u0000${binding.property}`;
    if (semanticTargets.has(semanticTarget)) {
      throw new StoreConfigurationError(
        `Multiple bindings claim semantic property ${binding.entityId}.${binding.property}.`,
      );
    }
    semanticTargets.add(semanticTarget);

    const entityProperties = propertyKeys.get(binding.entityId);
    if (!entityProperties) {
      throw new StoreConfigurationError(
        `Binding ${binding.id} references missing entity ${binding.entityId}.`,
      );
    }
    if (!entityProperties.has(binding.property)) {
      throw new StoreConfigurationError(
        `Binding ${binding.id} references unknown property ${binding.entityId}.${binding.property}.`,
      );
    }
    const expectedType = propertyTypes.get(binding.entityId)?.get(binding.property);
    if (expectedType !== binding.valueType) {
      throw new StoreConfigurationError(
        `Binding ${binding.id} has type ${binding.valueType}, expected ${String(expectedType)}.`,
      );
    }
    const expectedUnit = propertyUnits.get(binding.entityId)?.get(binding.property);
    if (expectedUnit !== binding.unit) {
      throw new StoreConfigurationError(
        `Binding ${binding.id} has unit ${String(binding.unit)}, expected ${String(expectedUnit)}.`,
      );
    }
  }
}
