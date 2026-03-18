import { runTeslaSingleRunLocalCli } from "./runTeslaSingleRunLocal";

runTeslaSingleRunLocalCli().then((exitCode) => {
  process.exitCode = exitCode;
});
