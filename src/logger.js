import chalk from "chalk";

const timestamp = () => chalk.gray(`[${new Date().toLocaleTimeString("id-ID")}]`);

export const log = {
  info: (msg) => console.log(`${timestamp()} ${chalk.cyan("ℹ")} ${msg}`),
  success: (msg) => console.log(`${timestamp()} ${chalk.green("✔")} ${msg}`),
  warn: (msg) => console.log(`${timestamp()} ${chalk.yellow("⚠")} ${msg}`),
  error: (msg) => console.log(`${timestamp()} ${chalk.red("✖")} ${msg}`),
  title: (msg) => console.log(`\n${chalk.bold.magenta(msg)}\n`),
  divider: () => console.log(chalk.gray("─".repeat(50))),
};
