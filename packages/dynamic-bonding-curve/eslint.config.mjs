import { config } from "@meteora-ag/ts-sdk-config/base";

/** @type {import("eslint").Linter.Config} */
export default {
    ...config,
    rules: {
        ...config.rules,
        "no-console": ["error", { allow: ["warn", "error"] }]
    }
};
