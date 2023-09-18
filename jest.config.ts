import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  setupFiles: ["dotenv/config"],
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts"],
  testPathIgnorePatterns: ["/node_modules/", "/__fixtures__/", "helpers?.ts"],
  transform: {
    "\\.ts$": ["ts-jest", { tsconfig: "./tsconfig.tests.json" }],
    "\\.js$": "babel-jest",
  },
};

export default jestConfig;
