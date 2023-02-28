import type { InitialOptionsTsJest } from "ts-jest";

const config: InitialOptionsTsJest = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/setupJestMock.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest-setup.ts"],
};

export default config;
