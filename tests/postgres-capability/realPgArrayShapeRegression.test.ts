import { describe, expect, it } from "vitest";
import { POSTGRES_INSPECTION_QUERIES } from "../../src/providers/capability/postgres/index.js";
import { FakeClientFactory, fail, harness, request } from "./helpers.js";

describe("real PostgreSQL array row-shape regression", () => {
  it("casts name[] catalog aggregates to text[] in both fixed queries", () => {
    expect(POSTGRES_INSPECTION_QUERIES.indexes).toContain("))::text[]");
    expect(POSTGRES_INSPECTION_QUERIES.constraints).toContain("cols.names::text[]");
    expect(POSTGRES_INSPECTION_QUERIES.constraints).toContain("refs.names::text[]");
  });

  it("still fails closed if an indexes row contains a PostgreSQL array literal string", async () => {
    const factory = new FakeClientFactory({}, {
      indexes: [{ schema: "app", table: "a", index: "a_idx", unique: false, primary: false, columns: "{code}", expression_index: false }],
    });
    fail(await harness(factory).provider.invoke(request({ operation: "indexes", schema: "app", table: "a" })), "INTERNAL_ERROR", false);
  });

  it("still fails closed if a constraints row contains PostgreSQL array literal strings", async () => {
    const factory = new FakeClientFactory({}, {
      constraints: [{ schema: "app", table: "a", constraint: "a_fk", type: "foreign_key", columns: "{parent_id}", referenced_schema: "app", referenced_table: "parent", referenced_columns: "{id}", deferrable: false, initially_deferred: false }],
    });
    fail(await harness(factory).provider.invoke(request({ operation: "constraints", schema: "app", table: "a" })), "INTERNAL_ERROR", false);
  });
});
