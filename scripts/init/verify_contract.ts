import { run, upgrades } from "hardhat";

import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
  const permit2Address = FileUtils.getContractAddress(Constants.PERMIT2);
  const ltTokenAddress = FileUtils.getContractAddress(Constants.LT_TOKEN);
  const veLightAddress = FileUtils.getContractAddress(Constants.VELT_TOKEN);
  const gombocControllerAddress = FileUtils.getContractAddress(Constants.GAUGE_CONTROLLER);
  const minterAddress = FileUtils.getContractAddress(Constants.LT_MINTER);
  const poolGombocAddress = FileUtils.getContractAddress(Constants.POOL_GAUGE);
  const gombocFactory = FileUtils.getContractAddress(Constants.GAUGE_FACTORY);
  const smartWalletWhitelist = FileUtils.getContractAddress(Constants.SmartWalletWhitelist);
  const restrictedAddress = FileUtils.getContractAddress(Constants.RESTRICTED_LIST);
  const hopeAddress = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
  const stakingHopeAddress = FileUtils.getContractAddress(Constants.STAKING_HOPE_GAUGE);

  const burnerManagerAddress = FileUtils.getContractAddress(Constants.BurnerManager);
  const feeDistributorAddress = FileUtils.getContractAddress(Constants.FeeDistributor);
  const gombocFeeDistributorAddress = FileUtils.getContractAddress(Constants.GaugeFeeDistributor);
  const underlyingBurnerAddress = FileUtils.getContractAddress(Constants.UnderlyingBurner);
  const swapFeeToVaultAddress = FileUtils.getContractAddress(Constants.SwapFeeToVault);
  const hopeSwapBurnerAddress = FileUtils.getContractAddress(Constants.HopeSwapBurner);

  // const hopeConnectVaultAddress = FileUtils.getContractAddress(Constants.HOPE_CONNET_VAULT);
  // const stHopeConnectAddress = FileUtils.getContractAddress(Constants.stHOPE_CONNET_VAULT);

  await verifyContract(permit2Address, []);
  await verifyContract(await upgrades.erc1967.getImplementationAddress(ltTokenAddress), []);
  await verifyContract(veLightAddress, [ltTokenAddress, permit2Address]);
  await verifyContract(gombocControllerAddress, [ltTokenAddress, veLightAddress]);
  await verifyContract(minterAddress, [ltTokenAddress, gombocControllerAddress]);
  await verifyContract(poolGombocAddress, []);
  await verifyContract(gombocFactory, [poolGombocAddress, minterAddress, permit2Address]);
  await verifyContract(smartWalletWhitelist, []);
  await verifyContract(restrictedAddress, []);
  await verifyContract(await upgrades.erc1967.getImplementationAddress(hopeAddress), []);
  // hope, minter, permit2, ownership
  await verifyContract(stakingHopeAddress, [hopeAddress, minterAddress, permit2Address]);

  await verifyContract(burnerManagerAddress, []);
  await verifyContract(await upgrades.erc1967.getImplementationAddress(feeDistributorAddress), []);
  await verifyContract(await upgrades.erc1967.getImplementationAddress(gombocFeeDistributorAddress), []);
  await verifyContract(await upgrades.erc1967.getImplementationAddress(underlyingBurnerAddress), []);
  await verifyContract(swapFeeToVaultAddress, [burnerManagerAddress, underlyingBurnerAddress]);
  await verifyContract(hopeSwapBurnerAddress, [hopeAddress, swapFeeToVaultAddress])

  // await verifyContract(await upgrades.erc1967.getImplementationAddress(hopeConnectVaultAddress), []);
  // await verifyContract(await upgrades.erc1967.getImplementationAddress(stHopeConnectAddress), []);
}

async function verifyContract(address: string, args: any) {
  try {
    console.log("Verifying contract...   ", address);
    await run("verify:verify", {
      address: address,
      constructorArguments: args
    });
  } catch (err: any) {
    if (err.toString().includes("Contract source code already verified")) {
      console.log(" Contract source code already verified");
    } else {
      console.log(err);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});