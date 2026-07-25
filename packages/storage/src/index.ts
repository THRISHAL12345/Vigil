import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// For local v1 development, we use a hidden folder in the monorepo root.
// In production, this would be backed by S3.
const STORAGE_DIR = path.resolve(__dirname, "../../../.vigil-storage");

async function ensureStorageDir() {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

export async function saveBlob(key: string, content: string | Buffer): Promise<string> {
  await ensureStorageDir();
  const filePath = path.join(STORAGE_DIR, key);
  
  // Prevent directory traversal
  if (!filePath.startsWith(STORAGE_DIR)) {
    throw new Error("Invalid storage key");
  }

  await fs.writeFile(filePath, content);
  return `local://${key}`;
}

export async function loadBlob(ref: string): Promise<string> {
  if (!ref.startsWith("local://")) {
    throw new Error(`Unsupported storage scheme or mock reference: ${ref}`);
  }

  const key = ref.replace("local://", "");
  const filePath = path.join(STORAGE_DIR, key);

  if (!filePath.startsWith(STORAGE_DIR)) {
    throw new Error("Invalid storage key");
  }

  return await fs.readFile(filePath, "utf-8");
}
