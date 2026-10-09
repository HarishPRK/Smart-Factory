import { describe, expect, it } from "vitest";
import { isPLCDataTopic, PLC_DATA_TOPIC_FILTER } from "./plcService";
import { FACTORY_UNS_FILTER, isFactoryNamespaceTopic, NAMESPACE_LEVELS } from "../components/uns/namespaceModel";

describe("factory subscription namespace", () => {
  it("subscribes PLC and UNS to the new root and accepts all six hierarchy levels", () => {
    expect(PLC_DATA_TOPIC_FILTER).toBe("prplInnovationHub/#");
    expect(FACTORY_UNS_FILTER).toBe(PLC_DATA_TOPIC_FILTER);
    expect(NAMESPACE_LEVELS).toEqual(["Location", "Site", "Area", "Line", "Cell", "Equipment"]);
    for (const topic of ["prplInnovationHub", "prplInnovationHub/McKinney/production/lineA/cell1/plc1/data/boardA"]) {
      expect(isPLCDataTopic(topic)).toBe(true);
      expect(isFactoryNamespaceTopic(topic)).toBe(true);
    }
  });
  it("excludes the old namespace, spelling variants and unrelated roots", () => {
    for (const topic of ["prplHome/McKinney/lineA/plc1/data", "prp1InnovationHub/data", "prplInnovationHub2/data", "meter/data", "lorawan/data"]) {
      expect(isPLCDataTopic(topic)).toBe(false);
      expect(isFactoryNamespaceTopic(topic)).toBe(false);
    }
  });
});
