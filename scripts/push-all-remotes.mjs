import { execFileSync } from "node:child_process";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function main() {
  let branch;
  try {
    branch = git(["branch", "--show-current"]);
  } catch (error) {
    console.error("[push] Не удалось определить текущую ветку.");
    process.exitCode = 1;
    return;
  }

  if (!branch) {
    console.error("[push] Автоотправка недоступна в detached HEAD.");
    process.exitCode = 1;
    return;
  }

  const remotes = git(["remote"]).split(/\r?\n/).filter(Boolean);
  if (remotes.length === 0) {
    console.log("[push] Настроенных репозиториев нет.");
    return;
  }

  let failed = false;
  for (const remote of remotes) {
    console.log(`[push] ${remote}: ${branch}...`);
    try {
      execFileSync("git", ["push", remote, `HEAD:${branch}`], {
        stdio: "inherit",
      });
    } catch {
      failed = true;
      console.error(`[push] Ошибка отправки в ${remote}.`);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main();
