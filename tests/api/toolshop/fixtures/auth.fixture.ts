import {
  test as base,
  expect,
  type APIRequestContext,
  type PlaywrightWorkerArgs,
  type WorkerFixture,
} from "@playwright/test";
import { LoginResponseSchema } from "../schemas/user.schema";

export type Credentials = { email: string; password: string };

export function credentials(envPrefix: string): Credentials {
  const email = process.env[`${envPrefix}_EMAIL`];
  const password = process.env[`${envPrefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`${envPrefix}_EMAIL dan ${envPrefix}_PASSWORD belum diisi di .env`);
  }
  return { email, password };
}

export async function login(api: APIRequestContext, { email, password }: Credentials) {
  const response = await api.post("/users/login", { data: { email, password } });
  expect(response.status(), `login ${email} gagal`).toBe(200);
  return LoginResponseSchema.parse(await response.json()).access_token;
}

function tokenFor(
  envPrefix: string,
): [WorkerFixture<string, PlaywrightWorkerArgs>, { scope: "worker" }] {
  return [
    async ({ playwright }, use, workerInfo) => {
      const api = await playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL });
      const token = await login(api, credentials(envPrefix));
      await api.dispose();
      await use(token);
    },
    { scope: "worker" },
  ];
}

type AuthFixtures = {
  adminToken: string;
  customerToken: string;
};

export const test = base.extend<object, AuthFixtures>({
  adminToken: tokenFor("TOOLSHOP_ADMIN"),
  customerToken: tokenFor("TOOLSHOP_CUSTOMER"),
});
