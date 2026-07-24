import { describe, it, expect } from "vitest";
import { createParser } from "../src/index.js";

describe("Language Adapters (web-tree-sitter)", () => {
  it("should extract call sites from TypeScript", async () => {
    const tsCode = `
      import stripe from "stripe";
      const s = new stripe("sk_test_123");
      
      async function main() {
        const charge = await s.charges.create({
          amount: 2000,
          currency: "usd",
        });
      }
    `;

    const parser = await createParser("typescript", tsCode, "test.ts");
    expect(parser.ast).toBeDefined();

    // In a real scenario we'd use stripeSurfaceMap's calleePatterns, which is just ["stripe.charges.create"]
    // But our dummy code uses `s.charges.create`, let's just see if it finds "s.charges.create"
    const sites = parser.extractCallSites(["s.charges.create"]);
    
    expect(sites).toHaveLength(1);
    expect(sites[0].snippet).toBe("s.charges.create");
    expect(sites[0].startLine).toBe(6);
  });

  it("should extract call sites from Python", async () => {
    const pyCode = `
import stripe
stripe.api_key = "sk_test_123"

def main():
    charge = stripe.Charge.create(
        amount=2000,
        currency="usd"
    )
    `;

    const parser = await createParser("python", pyCode, "test.py");
    expect(parser.ast).toBeDefined();

    const sites = parser.extractCallSites(["stripe.Charge.create"]);
    
    expect(sites).toHaveLength(1);
    expect(sites[0].snippet).toBe("stripe.Charge.create");
    expect(sites[0].startLine).toBe(6);
  });
});
