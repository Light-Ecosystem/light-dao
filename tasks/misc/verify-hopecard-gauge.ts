import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";

task(`verify-hopecard-gauge`, `Etherscan verify HopeCardGauge`).setAction(
  async (_, hre) => {
    if (!hre.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }
    // set address first
    let receiver = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
    let ltToken = FileUtils.getContractAddress(Constants.LT_TOKEN);
    let gaugeController = FileUtils.getContractAddress(
      Constants.GAUGE_CONTROLLER
    );
    let minter = FileUtils.getContractAddress(Constants.LT_MINTER);
    const hopeCardGaugeAddress = FileUtils.getContractAddress(
      Constants.HopeCardGauge
    );
    console.log("HopeCardGauge: ", hopeCardGaugeAddress);
    try {
      await hre.run("verify:verify", {
        contract: "contracts/gauges/HopeCardGauge.sol:HopeCardGauge",
        address: hopeCardGaugeAddress,
        constructorArguments: [ltToken, gaugeController, minter, receiver],
      });
    } catch (error) {
      console.error(error);
    }
    console.log(`- Verifying HopeCardGauge :`);
  }
);
