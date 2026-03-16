import { runTeslaContinuousLiveCli } from "./runTeslaContinuousLive";

runTeslaContinuousLiveCli().then((exitCode) => {
  process.exitCode = exitCode;
});
