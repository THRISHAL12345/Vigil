import yaml from "yaml";
import crypto from "crypto";
import { SpecSnapshot } from "@vigil/schemas";

export async function normalizeSpec(
  vendorId: string,
  rawContent: string,
  sourceType: string,
  sourceRef: string
): Promise<SpecSnapshot> {
  let parsed: any;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    parsed = yaml.parse(rawContent);
  }

  // Extract paths and components for our simplified normalized tree
  const normalizedTree = {
    paths: parsed?.paths || {},
    components: parsed?.components || {},
  };

  const hash = crypto.createHash("sha256").update(JSON.stringify(normalizedTree)).digest("hex");

  return {
    id: crypto.randomUUID(),
    vendorId,
    sourceType: sourceType as any,
    sourceRef,
    normalizedTreeHash: hash,
    normalizedTreeRef: "s3://mock-bucket/" + hash + ".json", // placeholder for external tree storage
    fetchedAt: new Date().toISOString()
  };
}
