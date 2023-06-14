import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";

task(
  `verify-fee-collector-burner`,
  `Etherscan verify FeeToVault & SwapBurnder contract`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const feeToVaultProxyAddress = FileUtils.getContractAddress(
    Constants.FeeToVault
  );
  const swapBurnerAddress = FileUtils.getContractAddress(Constants.SwapBurner);
  const feeToVaultImplAddress =
    await hre.upgrades.erc1967.getImplementationAddress(feeToVaultProxyAddress);
  console.log("Impl: ", feeToVaultImplAddress);
  console.log("Proxy: ", feeToVaultProxyAddress);
  console.log("Burnder: ", swapBurnerAddress);

  let HOPE = "0x784388A036cb9c8c680002F43354E856f816F844";
  let burnerManager = "0x25b6b8497F5614C4A8A255bC091191BC40f16585";
  let underlyingBurner = "0xdd2a0C2715C7aC7BFafec2D27B13f049C499c8aD";

  console.log(`- Verifying FeeToVault Implementation:`);
  try {
    await hre.run("verify:verify", {
      address: feeToVaultImplAddress,
      constructorArguments: [],
    });
  } catch (error) {
    console.error(error);
  }
  console.log(`- Verifying FeeToVault Proxy :`);
  try {
    await hre.run("verify:verify", {
      address: feeToVaultProxyAddress,
      constructorArguments: [burnerManager, underlyingBurner, HOPE],
    });
  } catch (error) {
    console.error(error);
  }
  console.log(`- Verifying SwapBurner:`);
  try {
    await hre.run("verify:verify", {
      address: swapBurnerAddress,
      constructorArguments: [HOPE, feeToVaultProxyAddress],
    });
  } catch (error) {
    console.error(error);
  }
});
