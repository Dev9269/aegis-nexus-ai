import { readFileSync, readdirSync } from "node:fs";

const needle = process.env.VITE_DEMO_PASSWORD || "ChangeMe-Demo!2026";
const assetDir = new URL("../dist/assets/", import.meta.url);
const files = readdirSync(assetDir).filter((file) => file.endsWith(".js"));
const leaked = files.filter((file) => readFileSync(new URL(file, assetDir), "utf8").includes(needle));

if (leaked.length) {
  console.error(`Demo password found in production assets: ${leaked.join(", ")}`);
  process.exit(1);
}

console.log("Build secret check passed: no demo password in production assets.");
