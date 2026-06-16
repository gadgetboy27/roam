/**
 * Regression guard for the account-deletion cascade.
 *
 * `usersRepo.deleteUser()` must remove EVERY user-owned row before deleting the
 * `users` row, otherwise a future edit could silently drop a table and leave
 * PII behind (emergency contacts, check-in locations, alert history, etc.).
 *
 * We mock the `../db` module so `db.transaction(cb)` runs `cb` with a fake `tx`
 * whose `.delete(table).where(...)` simply records which Drizzle table object
 * was targeted. Then we assert the set of targeted tables includes all of the
 * user-owned tables AND that the `users` row delete happened. This needs no
 * real database connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Record every table handed to tx.delete(...).
const deletedTables: unknown[] = [];

// Fake transaction object: delete() records the table and returns a chainable
// thenable so `await tx.delete(table).where(...)` resolves cleanly.
function makeTx() {
  return {
    delete(table: unknown) {
      deletedTables.push(table);
      return {
        where: (_cond?: unknown) => Promise.resolve(undefined),
      };
    },
  };
}

// Mock the db module BEFORE importing the repo (which imports `../db`).
// We only need `transaction`; the rest of the module isn't touched by deleteUser.
vi.mock("../../server/db", () => ({
  db: {
    transaction: async (cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
      return cb(makeTx());
    },
  },
  pool: {},
}));

// Import AFTER the mock is registered.
import { usersRepo } from "../../server/storage/users.repo";
import {
  users,
  safetyAlertLog,
  safetyCheckins,
  safetyContacts,
  blocks,
  reports,
  groupEventAttendees,
  groupMessages,
  groupMembers,
  bucketList,
  typingIndicators,
} from "../../shared/schema";

describe("usersRepo.deleteUser — cascade covers all user-owned tables", () => {
  beforeEach(() => {
    deletedTables.length = 0;
  });

  // Every table that holds user-owned rows and must be cleaned up.
  const requiredTables: Array<{ name: string; table: unknown }> = [
    { name: "safetyAlertLog", table: safetyAlertLog },
    { name: "safetyCheckins", table: safetyCheckins },
    { name: "safetyContacts", table: safetyContacts },
    { name: "blocks", table: blocks },
    { name: "reports", table: reports },
    { name: "groupEventAttendees", table: groupEventAttendees },
    { name: "groupMessages", table: groupMessages },
    { name: "groupMembers", table: groupMembers },
    { name: "bucketList", table: bucketList },
    { name: "typingIndicators", table: typingIndicators },
  ];

  it("runs inside a single db.transaction", async () => {
    const spy = vi.fn(async (cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
      cb(makeTx())
    );
    const db = (await import("../../server/db")).db;
    const orig = db.transaction;
    // @ts-expect-error - swap for assertion
    db.transaction = spy;
    try {
      await usersRepo.deleteUser("user-abc");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      // @ts-expect-error - restore
      db.transaction = orig;
    }
  });

  it("deletes the users row (the final, cascade-firing delete)", async () => {
    await usersRepo.deleteUser("user-abc");
    expect(deletedTables).toContain(users);
  });

  it("deletes the users row LAST, after the owned tables are cleared", async () => {
    await usersRepo.deleteUser("user-abc");
    const lastTarget = deletedTables[deletedTables.length - 1];
    expect(lastTarget).toBe(users);
  });

  // Guard: a future edit must not silently drop any user-owned table.
  for (const { name, table } of requiredTables) {
    it(`deletes from ${name} so its PII is not left behind`, async () => {
      await usersRepo.deleteUser("user-abc");
      expect(deletedTables).toContain(table);
    });
  }

  it("targets EVERY required user-owned table plus users (no table dropped)", async () => {
    await usersRepo.deleteUser("user-abc");
    const targeted = new Set(deletedTables);
    for (const { name, table } of requiredTables) {
      expect(targeted.has(table), `missing delete for ${name}`).toBe(true);
    }
    expect(targeted.has(users), "missing delete for users").toBe(true);
  });
});
