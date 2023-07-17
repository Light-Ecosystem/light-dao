import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";
import { waitForTx } from "../../helpers/tx";

task(`setup-burner-router`, `Setups SwapBurner routers`).setAction(
  async (_, hre) => {
    if (!hre.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }
    // 1. Set address first
    const ROUTER_02 = "0x3E719F9743B246C0caa053eBeE60f2C4169D8259";
    // 2. Set SwapBurner routers
    const swapBurnerAddress = FileUtils.getContractAddress(
      Constants.SwapBurner
    );
    const swapBurner = await hre.ethers.getContractAt(
      "SwapBurner",
      swapBurnerAddress
    );
    await waitForTx(await swapBurner.setRouters([ROUTER_02]));
    const isSetupRouter02 = (await swapBurner.routers(0)) === ROUTER_02;
    if (isSetupRouter02) {
      console.log(`- Successfully setup Router02 (${ROUTER_02}) to SwapBurner`);
    }
  }
);
