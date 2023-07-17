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

  let HOPE = "0x9bA97e0913Dd0fbd4E5fedA936db9D1f1C632273";
  let burnerManager = "0x46DD0d74189c5b91CE235eC3B09cB5311AB72647";
  let underlyingBurner = "0x7A638E2b45dac685C6a70C97D719F73bD40bff83";

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
