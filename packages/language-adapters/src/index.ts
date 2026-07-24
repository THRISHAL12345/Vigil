import { parseTypeScript } from "./typescript/index.js";
import { parsePython } from "./python/index.js";
import { UsageSite } from "@vigil/schemas";

export interface ParserResult {
  ast: any; // Would be tree-sitter AST root node
  extractCallSites: (surfaceMapEntry: any) => Partial<UsageSite>[];
}

export async function createParser(language: string, fileContent: string): Promise<ParserResult> {
  switch (language) {
    case "typescript":
    case "javascript":
      return parseTypeScript(fileContent);
    case "python":
      return parsePython(fileContent);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
