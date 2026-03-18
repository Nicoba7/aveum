import { runDevSingleRunLocalCli } from "./runDevSingleRunLocal";

runDevSingleRunLocalCli().then((exitCode) => {
  process.exitCode = exitCode;
});