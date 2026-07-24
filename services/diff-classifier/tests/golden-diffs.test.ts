import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { classifyDelta } from "../src/classifier.js";
import { loadFixtureSnapshots, FixtureFormat } from "./helpers/load-fixture-snapshots.js";
import { ClassifiedChange } from "@vigil/schemas";

const VENDOR_ADAPTERS_DIR = path.resolve(__dirname, "../../../packages/vendor-adapters");

if (existsSync(VENDOR_ADAPTERS_DIR)) {
  const vendorDirs = readdirSync(VENDOR_ADAPTERS_DIR);

  for (const vendorId of vendorDirs) {
    const fixtureDir = path.join(VENDOR_ADAPTERS_DIR, vendorId, "fixtures");
    
    if (existsSync(fixtureDir)) {
      const fixtures = readdirSync(fixtureDir).filter((f) => f.endsWith(".json"));

      if (fixtures.length > 0) {
        describe(`golden diffs: ${vendorId}`, () => {
          for (const fixtureFile of fixtures) {
            const fixturePath = path.join(fixtureDir, fixtureFile);
            const fixture: FixtureFormat = JSON.parse(readFileSync(fixturePath, "utf-8"));

            it(`correctly classifies: ${fixture.description}`, async () => {
              const { fromSnapshot, toSnapshot } = await loadFixtureSnapshots(fixture);
              
              const results: ClassifiedChange[] = [];
              for (const delta of fixture.mockDeltas) {
                const classified = await classifyDelta(delta, fromSnapshot, toSnapshot);
                results.push(classified);
              }

              const result = results.find((c) => c.path === fixture.expectedChange.path);

              expect(result).toBeDefined();
              expect(result?.classification).toBe(fixture.expectedChange.classification);
              expect(result?.ruleTriggered).toBe(fixture.expectedChange.ruleTriggered);
            });
          }
        });
      }
    }
  }
}
