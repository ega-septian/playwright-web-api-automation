import { mergeTests } from "@playwright/test";
import { test as redlineTest } from "redline-playwright/fixture";
import { test as authTest } from "./auth.fixture";
import { cleanup } from "./cleanup.fixture";
import { test as targetTest } from "./target.fixture";

export const test = mergeTests(redlineTest, authTest, targetTest).extend(cleanup);

export { expect } from "redline-playwright/fixture";
