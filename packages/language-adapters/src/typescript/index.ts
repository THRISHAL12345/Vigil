import { logger } from "@vigil/logger";
import { parse } from "@typescript-eslint/typescript-estree";
import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";

function getMemberExpressionString(node: TSESTree.Node): string | null {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    const obj = getMemberExpressionString(node.object);
    const prop = getMemberExpressionString(node.property);
    if (obj && prop) {
      return `${obj}.${prop}`;
    }
  }
  return null;
}

function traverse(node: TSESTree.Node, visitor: (n: TSESTree.Node) => void) {
  visitor(node);
  for (const key in node) {
    if (node.hasOwnProperty(key)) {
      const child = (node as any)[key];
      if (typeof child === 'object' && child !== null) {
        if (Array.isArray(child)) {
          child.forEach(c => {
            if (c && typeof c.type === 'string') {
              traverse(c, visitor);
            }
          });
        } else if (typeof child.type === 'string') {
          traverse(child, visitor);
        }
      }
    }
  }
}

export async function parseTypeScript(fileContent: string, filePath: string = "unknown.ts") {
  const ast = parse(fileContent, { loc: true, range: true });
  
  return {
    ast,
    extractCallSites: (calleePatterns: string[]) => {
      if (!calleePatterns || calleePatterns.length === 0) return [];
      
      const sites: any[] = [];
      
      traverse(ast, (node) => {
        if (node.type === AST_NODE_TYPES.CallExpression) {
          const calleeStr = getMemberExpressionString(node.callee);
          if (calleeStr && calleePatterns.includes(calleeStr)) {
            sites.push({
              filePath,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              snippet: calleeStr, // estree doesn't easily expose original source text without slicing the fileContent string
            });
          }
        }
      });
      
      return sites;
    }
  };
}
