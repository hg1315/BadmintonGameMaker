const config = {
  packageManager: "npm",
  testRunner: "vitest",
  mutate: ["src/lib/scheduler/**/*.ts", "src/lib/scoring/**/*.ts", "src/lib/fairness/**/*.ts"],
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "perTest",
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
};

export default config;
