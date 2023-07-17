import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";

task(
  `deploy-fee-collector-burner`,
  `Deploys FeeToVault & SwapBurner`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }
  // 0. Configure the Openzeppelin upgrade plugin Manifest file

  // 1. Set address first
  let HOPE = "0x9bA97e0913Dd0fbd4E5fedA936db9D1f1C632273";
  let burnerManager = "0x46DD0d74189c5b91CE235eC3B09cB5311AB72647";
  let underlyingBurner = "0x7A638E2b45dac685C6a70C97D719F73bD40bff83";

  // 2. Deloy FeeToVault  contract
  const FeeToVault = await hre.ethers.getContractFactory("FeeToVault");
  const feeToVault = await hre.upgrades.deployProxy(FeeToVault, [
    burnerManager,
    underlyingBurner,
    HOPE,
  ]);
  await feeToVault.deployed();
  console.log("- FeeToVault deployed: ", feeToVault.address);
  FileUtils.saveFrontendFiles(
    feeToVault.address,
    "FeeToVault",
    Constants.FeeToVault
  );

  // 3. Deploy new SwapBurner
  const SwapBurner = await hre.ethers.getContractFactory("SwapBurner");
  const swapBurner = await SwapBurner.deploy(HOPE, feeToVault.address);
  await swapBurner.deployed();
  console.log("- SwapBurner deployed: ", swapBurner.address);

  FileUtils.saveFrontendFiles(
    swapBurner.address,
    "SwapBurner",
    Constants.SwapBurner
  );
});
