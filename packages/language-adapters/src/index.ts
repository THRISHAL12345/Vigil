import { parseTypeScript } from "./typescript/index.js";
import { parsePython } from "./python/index.js";
import { UsageSite } from "@vigil/schemas";

export interface ParserResult {
  ast: any; // Would be tree-sitter AST root node
  extractCallSites: (calleePatterns: string[]) => Partial<UsageSite>[];
}

export async function createParser(language: string, fileContent: string, filePath: string = "unknown.ts"): Promise<ParserResult> {
  switch (language) {
    case "typescript":
    case "javascript":
      return parseTypeScript(fileContent, filePath);
    case "python":
      return parsePython(fileContent);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
