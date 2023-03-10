import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";

async function main() {

  const newOwnerAddress = "0x00";

  const ltToken = await ethers.getContractAt("LT", FileUtils.getContractAddress(Constants.LT_TOKEN));
  const veLight = await ethers.getContractAt("VotingEscrow", FileUtils.getContractAddress(Constants.VELT_TOKEN));
  const gombocController = await ethers.getContractAt("GombocController", FileUtils.getContractAddress(Constants.GAUGE_CONTROLLER));
  const poolGomboc = await ethers.getContractAt("PoolGomboc", FileUtils.getContractAddress(Constants.POOL_GAUGE));
  const gombocFactory = await ethers.getContractAt("GombocController", FileUtils.getContractAddress(Constants.GAUGE_FACTORY));
  const smartWalletWhitelist = await ethers.getContractAt("SmartWalletWhitelist", FileUtils.getContractAddress(Constants.SmartWalletWhitelist));
  const restricted = await ethers.getContractAt("RestrictedList", FileUtils.getContractAddress(Constants.RESTRICTED_LIST));
  const hope = await ethers.getContractAt("HOPE", FileUtils.getContractAddress(Constants.HOPE_TOKEN));
  const stakingHope = await ethers.getContractAt("StakingHOPE", FileUtils.getContractAddress(Constants.STAKING_HOPE_GAUGE));
  const feeDistributor = await ethers.getContractAt("FeeDistributor", FileUtils.getContractAddress(Constants.FeeDistributor));
  const gombocFeeDistributor = await ethers.getContractAt("GombocFeeDistributor", FileUtils.getContractAddress(Constants.GaugeFeeDistributor));
  const hopeSwapBurn = await ethers.getContractAt("HopeSwapBurner", FileUtils.getContractAddress(Constants.HopeSwapBurner));
  const underlyingBurner = await ethers.getContractAt("UnderlyingBurner", FileUtils.getContractAddress(Constants.UnderlyingBurner));
  const swapFeeToVault = await ethers.getContractAt("SwapFeeToVault", FileUtils.getContractAddress(Constants.SwapFeeToVault));

  console.log(ltToken.address);
  console.log(veLight.address);
  console.log(gombocController.address);
  console.log(smartWalletWhitelist.address);
  console.log(restricted.address);
  console.log(hope.address);
  console.log(stakingHope.address);
  console.log(feeDistributor.address);
  console.log(gombocFeeDistributor.address);
  console.log(hopeSwapBurn.address);
  console.log(underlyingBurner.address);
  console.log(swapFeeToVault.address);

  await hope.transferOwnership(newOwnerAddress);
  await gombocController.transferOwnership(newOwnerAddress);
  await restricted.transferOwnership(newOwnerAddress);
  await ltToken.transferOwnership(newOwnerAddress);
  await stakingHope.transferOwnership(newOwnerAddress);
  await veLight.transferOwnership(newOwnerAddress);
  await smartWalletWhitelist.transferOwnership(newOwnerAddress);
  await gombocController.transferOwnership(newOwnerAddress);
  await swapFeeToVault.transferOwnership(newOwnerAddress);
  await underlyingBurner.transferOwnership(newOwnerAddress);
  await hopeSwapBurn.transferOwnership(newOwnerAddress);
  await feeDistributor.transferOwnership(newOwnerAddress);
  await gombocFeeDistributor.transferOwnership(newOwnerAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});