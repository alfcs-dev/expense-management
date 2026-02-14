import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";

function extractJson<T>(payload: unknown): T {
  const value = payload as { result?: { data?: unknown } };
  const data = value.result?.data as { json?: unknown } | undefined;
  return (data?.json ?? data) as T;
}

describe("API smoke", () => {
  let app: FastifyInstance;
  let authCookie = "";

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("rejects protected procedure without auth", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/trpc/account.create",
      payload: {
        name: "Unauthorized Account",
        type: "cash",
        currency: "MXN",
        balance: 1000,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toContain("UNAUTHORIZED");
  });

  it("runs authenticated core lifecycle", async () => {
    const unique = Date.now().toString();
    const email = `smoke.${unique}@example.com`;
    const password = `Sm0ke-${unique}!`;

    const signUpResponse = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: {
        name: "Smoke User",
        email,
        password,
      },
    });

    expect(signUpResponse.statusCode).toBeLessThan(400);

    const setCookie = signUpResponse.headers["set-cookie"];
    const firstCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(firstCookie).toBeTruthy();
    authCookie = String(firstCookie).split(";")[0] ?? "";

    const categoryResponse = await app.inject({
      method: "POST",
      url: "/api/trpc/category.create",
      headers: { cookie: authCookie },
      payload: {
        name: `Smoke Category ${unique}`,
        color: "#4A6CF7",
      },
    });
    expect(categoryResponse.statusCode).toBe(200);
    const category = extractJson<{ id: string }>(categoryResponse.json());
    expect(category.id).toBeTruthy();

    const accountResponse = await app.inject({
      method: "POST",
      url: "/api/trpc/account.create",
      headers: { cookie: authCookie },
      payload: {
        name: `Smoke Cash ${unique}`,
        type: "cash",
        currency: "MXN",
        balance: 100000,
      },
    });
    expect(accountResponse.statusCode).toBe(200);
    const account = extractJson<{ id: string }>(accountResponse.json());
    expect(account.id).toBeTruthy();

    const budgetResponse = await app.inject({
      method: "POST",
      url: "/api/trpc/budget.create",
      headers: { cookie: authCookie },
      payload: {
        month: 2,
        year: 2030,
        name: "Smoke Budget",
      },
    });
    expect(budgetResponse.statusCode).toBe(200);
    const budget = extractJson<{ id: string }>(budgetResponse.json());
    expect(budget.id).toBeTruthy();

    const recurringResponse = await app.inject({
      method: "POST",
      url: "/api/trpc/recurringExpense.create",
      headers: { cookie: authCookie },
      payload: {
        categoryId: category.id,
        sourceAccountId: account.id,
        description: "Smoke recurring",
        amount: 5000,
        currency: "MXN",
        frequency: "monthly",
        isAnnual: false,
        isActive: true,
      },
    });
    expect(recurringResponse.statusCode).toBe(200);

    const expenseResponse = await app.inject({
      method: "POST",
      url: "/api/trpc/expense.create",
      headers: { cookie: authCookie },
      payload: {
        budgetId: budget.id,
        categoryId: category.id,
        accountId: account.id,
        description: "Smoke manual expense",
        amount: 12345,
        currency: "MXN",
        date: "2030-02-15T12:00:00.000Z",
      },
    });
    expect(expenseResponse.statusCode).toBe(200);
    const expense = extractJson<{ id: string }>(expenseResponse.json());
    expect(expense.id).toBeTruthy();

    const listInput = encodeURIComponent(JSON.stringify({ budgetId: budget.id }));
    const listResponse = await app.inject({
      method: "GET",
      url: `/api/trpc/expense.list?input=${listInput}`,
      headers: { cookie: authCookie },
    });
    expect(listResponse.statusCode).toBe(200);
    const list = extractJson<Array<{ id: string }>>(listResponse.json());
    expect(list.some((item) => item.id === expense.id)).toBe(true);
  });
});
