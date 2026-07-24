import Parser from "web-tree-sitter";

function getAttributeString(node: Parser.SyntaxNode): string | null {
  if (node.type === "identifier") {
    return node.text;
  }
  if (node.type === "attribute") {
    const obj = node.childForFieldName("object");
    const attr = node.childForFieldName("attribute");
    if (obj && attr) {
      const objStr = getAttributeString(obj);
      const attrStr = getAttributeString(attr);
      if (objStr && attrStr) {
        return `${objStr}.${attrStr}`;
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

export async function parsePython(parser: Parser, fileContent: string, filePath: string = "unknown.py") {
  const tree = parser.parse(fileContent);
  
  return {
    ast: tree,
    extractCallSites: (calleePatterns: string[]) => {
      if (!calleePatterns || calleePatterns.length === 0) return [];
      
      const sites: any[] = [];
      
      traverse(tree.rootNode, (node) => {
        if (node.type === "call") { // python tree-sitter uses 'call'
          const calleeNode = node.childForFieldName("function");
          if (calleeNode) {
            const calleeStr = getAttributeString(calleeNode);
            if (calleeStr && calleePatterns.includes(calleeStr)) {
              sites.push({
                filePath,
                startLine: node.startPosition.row + 1,
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
