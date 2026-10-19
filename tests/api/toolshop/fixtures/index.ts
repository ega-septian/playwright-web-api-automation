import { mergeTests } from "@playwright/test";
import { test as redlineTest } from "redline-playwright/fixture";
import { test as authTest } from "./auth.fixture";

export const test = mergeTests(redlineTest, authTest);

export { expect } from "redline-playwright/fixture";
