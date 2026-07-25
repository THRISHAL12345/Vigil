import yaml from "yaml";
import crypto from "crypto";
import { SpecSnapshot } from "@vigil/schemas";
import { saveBlob } from "@vigil/storage";

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
  const blobRef = await saveBlob(`${hash}.json`, JSON.stringify(normalizedTree, null, 2));

  return {
    id: crypto.randomUUID(),
    vendorId,
    sourceType: sourceType as any,
    sourceRef,
    normalizedTreeHash: hash,
    normalizedTreeRef: blobRef,
    fetchedAt: new Date().toISOString()
  };
}
