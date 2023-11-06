import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";

task(`deploy-grants-gauge`, `deploy GrantsGauge`).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  // set address first, grants gauge vault address
  let receiver = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
  let ltToken = "0xC0f5ee5C2e6E830d114BFAAecE310c7625C0EF00";
  let gaugeController = "0x405604a1F28e89B736353016CF504Fe26C0E32Df";
  let minter = "0x2DD369a0126B014f5A574f92FB5510B4EaB4eF01";
  let multiSig = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";

  const TransmitEmissionsGauge = await hre.ethers.getContractFactory(
    "TransmitEmissionsGauge"
  );
  const transmitEmissionsGauge = await TransmitEmissionsGauge.deploy(
    ltToken,
    gaugeController,
    minter,
    receiver
  );
  await transmitEmissionsGauge.deployed();
  console.log(
    "TransmitEmissionsGauge Address: ",
    transmitEmissionsGauge.address
  );
  FileUtils.saveFrontendFiles(
    transmitEmissionsGauge.address,
    "TransmitEmissionsGauge",
    Constants.TransmitEmissionsGauge
  );

  await transmitEmissionsGauge.transferOwnership(multiSig);
  console.log(`[INFO] Owner transfer to ${multiSig}`);
});
