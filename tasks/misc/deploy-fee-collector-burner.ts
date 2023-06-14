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
  let HOPE = "0x784388A036cb9c8c680002F43354E856f816F844";
  let burnerManager = "0x25b6b8497F5614C4A8A255bC091191BC40f16585";
  let underlyingBurner = "0xdd2a0C2715C7aC7BFafec2D27B13f049C499c8aD";

  // 2. Deloy FeeToVault  contract
  const FeeToVault = await hre.ethers.getContractFactory("FeeToVault");
  const feeToVault = await hre.upgrades.deployProxy(FeeToVault, [
    burnerManager,
    underlyingBurner,
    HOPE,
  ]);
  await feeToVault.deployed();
  console.log("- FeeToVault depeloyed: ", feeToVault.address);
  FileUtils.saveFrontendFiles(
    feeToVault.address,
    "FeeToVault",
    Constants.FeeToVault
  );

  // 3. Deploy new SwapBurner
  const SwapBurner = await hre.ethers.getContractFactory("SwapBurner");
  const swapBurner = await SwapBurner.deploy(HOPE, feeToVault.address);
  await swapBurner.deployed();
  console.log("- SwapBurner depeloyed: ", swapBurner.address);

  FileUtils.saveFrontendFiles(
    swapBurner.address,
    "SwapBurner",
    Constants.SwapBurner
  );
});
