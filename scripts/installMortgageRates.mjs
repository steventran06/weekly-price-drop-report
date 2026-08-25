import {
  readFile,
  writeFile,
} from "node:fs/promises";

async function main() {
  const packagePath =
    new URL(
      "../package.json",
      import.meta.url,
    );

  const packageJson =
    JSON.parse(
      await readFile(
        packagePath,
        "utf8",
      ),
    );

  packageJson.scripts ??= {};
  packageJson.scripts["mortgage-rates"] =
    "tsx src/mortgageRates/index.ts";
  packageJson.scripts["mortgage-rates:preview"] =
    "MORTGAGE_RATES_DRY_RUN=true tsx src/mortgageRates/index.ts";

  await writeFile(
    packagePath,
    JSON.stringify(
      packageJson,
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const gitignorePath =
    new URL(
      "../.gitignore",
      import.meta.url,
    );

  const currentGitignore =
    await readFile(
      gitignorePath,
      "utf8",
    );

  const line =
    "output/mortgage-rates/";

  if (
    !currentGitignore
      .split(/\r?\n/)
      .includes(line)
  ) {
    await writeFile(
      gitignorePath,
      currentGitignore.replace(/\s*$/, "\n") +
        `${line}\n`,
      "utf8",
    );
  }

  console.log(
    "Installed mortgage-rate npm scripts and .gitignore entry.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
