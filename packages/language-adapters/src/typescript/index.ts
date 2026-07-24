import Parser from "web-tree-sitter";

function getMemberExpressionString(node: Parser.SyntaxNode): string | null {
  if (node.type === "identifier" || node.type === "property_identifier") {
    return node.text;
  }
  if (node.type === "member_expression") {
    const obj = node.childForFieldName("object");
    const prop = node.childForFieldName("property");
    if (obj && prop) {
      const objStr = getMemberExpressionString(obj);
      const propStr = getMemberExpressionString(prop);
      if (objStr && propStr) {
        return `${objStr}.${propStr}`;
      }
    }
  }
  return null;
}

function traverse(node: Parser.SyntaxNode, visitor: (n: Parser.SyntaxNode) => void) {
  visitor(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      traverse(child, visitor);
    }
  }
}

export async function parseTypeScript(parser: Parser, fileContent: string, filePath: string = "unknown.ts") {
  const tree = parser.parse(fileContent);
  
  return {
    ast: tree,
    extractCallSites: (calleePatterns: string[]) => {
      if (!calleePatterns || calleePatterns.length === 0) return [];
      
      const sites: any[] = [];
      
      traverse(tree.rootNode, (node) => {
        if (node.type === "call_expression") {
          const calleeNode = node.childForFieldName("function");
          if (calleeNode) {
            const calleeStr = getMemberExpressionString(calleeNode);
            if (calleeStr && calleePatterns.includes(calleeStr)) {
              sites.push({
                filePath,
                startLine: node.startPosition.row + 1, // tree-sitter is 0-indexed for rows, ESTree was 1-indexed
                endLine: node.endPosition.row + 1,
                snippet: calleeStr,
              });
            }
          }
        }
      });
      
      return sites;
    }
  };
}
