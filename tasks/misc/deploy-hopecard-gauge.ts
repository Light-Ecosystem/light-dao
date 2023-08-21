import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";

task(
  `deploy-hopecard-gauge`,
  `deploy HopeCardGauge`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

   // set address first, hopecard vault address
   let receiver = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
   let ltToken = FileUtils.getContractAddress(Constants.LT_TOKEN);
   let gaugeController = FileUtils.getContractAddress(Constants.GAUGE_CONTROLLER);
   let minter = FileUtils.getContractAddress(Constants.LT_MINTER);

   const HopeCardGauge = await hre.ethers.getContractFactory("HopeCardGauge");
   const hopeCardGauge = await HopeCardGauge.deploy(ltToken, gaugeController, minter, receiver);
   await hopeCardGauge.deployed();
   console.log("hopeCardGauge Address: ", hopeCardGauge.address);
   FileUtils.saveFrontendFiles(hopeCardGauge.address, "HopeCardGauge", Constants.HopeCardGauge);
});
