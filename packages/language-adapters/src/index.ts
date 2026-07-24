import Parser from "web-tree-sitter";
import path from "path";
import { fileURLToPath } from "url";
import { parseTypeScript } from "./typescript/index.js";
import { parsePython } from "./python/index.js";
import { UsageSite } from "@vigil/schemas";

export interface ParserResult {
  ast: Parser.Tree;
  extractCallSites: (calleePatterns: string[]) => Partial<UsageSite>[];
}

let isInitialized = false;

export async function createParser(language: string, fileContent: string, filePath: string = "unknown.ts"): Promise<ParserResult> {
  if (!isInitialized) {
    await Parser.init({
      locateFile(scriptName: string, scriptDirectory: string) {
        // web-tree-sitter uses this to locate tree-sitter.wasm
        return scriptDirectory + scriptName;
      },
    });
    isInitialized = true;
  }

  const parser = new Parser();

  switch (language) {
    case "typescript":
    case "javascript": {
      const dir = path.dirname(fileURLToPath(import.meta.url));
      const wasmPath = path.join(dir, "..", "node_modules", "tree-sitter-wasms", "out", "tree-sitter-typescript.wasm");
      const lang = await Parser.Language.load(wasmPath);
      parser.setLanguage(lang);
      return parseTypeScript(parser, fileContent, filePath);
    }
    case "python": {
      const dir = path.dirname(fileURLToPath(import.meta.url));
      const wasmPath = path.join(dir, "..", "node_modules", "tree-sitter-wasms", "out", "tree-sitter-python.wasm");
      const lang = await Parser.Language.load(wasmPath);
      parser.setLanguage(lang);
      return parsePython(parser, fileContent, filePath);
    }
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
