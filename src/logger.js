import chalk from "chalk";

const ts = () => chalk.gray(`[${new Date().toLocaleTimeString("id-ID")}]`);

export const log = {
  info: (msg) => console.log(`${ts()} ${chalk.cyan("ℹ")}  ${msg}`),
  success: (msg) => console.log(`${ts()} ${chalk.green("✔")}  ${msg}`),
  warn: (msg) => console.log(`${ts()} ${chalk.yellow("⚠")}  ${msg}`),
  error: (msg) => console.log(`${ts()} ${chalk.red("✖")}  ${msg}`),
  title: (msg) => console.log(`\n${chalk.bold.white(msg)}`),
  divider: () => console.log(chalk.gray("─".repeat(55))),
  chain: (chain, msg) =>
    console.log(`${ts()} ${chalk.magenta(`[${chain.toUpperCase()}]`)} ${msg}`),
  wallet: (addr, msg) =>
    console.log(`${ts()} ${chalk.blue(`[${addr.slice(0, 6)}…${addr.slice(-4)}]`)} ${msg}`),
  dryRun: (msg) =>
    console.log(`${ts()} ${chalk.bgYellow.black(" DRY-RUN ")} ${msg}`),
  tx: (hash, explorer) =>
    console.log(`${ts()} ${chalk.green("⛓")}  Tx: ${chalk.underline(`${explorer}/tx/${hash}`)}`),
};
