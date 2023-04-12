import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";

async function main() {
  // todo
  const gnosisSafe = "0x00";

  const ltToken = await ethers.getContractAt("LT", FileUtils.getContractAddress(Constants.LT_TOKEN));
  const veLight = await ethers.getContractAt("VotingEscrow", FileUtils.getContractAddress(Constants.VELT_TOKEN));
  const gaugeController = await ethers.getContractAt("GaugeController", FileUtils.getContractAddress(Constants.GAUGE_CONTROLLER));
  // const poolGauge = await ethers.getContractAt("PoolGauge", FileUtils.getContractAddress(Constants.POOL_GAUGE));
  const gaugeFactory = await ethers.getContractAt("GaugeFactory", FileUtils.getContractAddress(Constants.GAUGE_FACTORY));
  const smartWalletWhitelist = await ethers.getContractAt("SmartWalletWhitelist", FileUtils.getContractAddress(Constants.SmartWalletWhitelist));
  const restricted = await ethers.getContractAt("RestrictedList", FileUtils.getContractAddress(Constants.RESTRICTED_LIST));
  const hope = await ethers.getContractAt("HOPE", FileUtils.getContractAddress(Constants.HOPE_TOKEN));
  const stakingHope = await ethers.getContractAt("StakingHOPE", FileUtils.getContractAddress(Constants.STAKING_HOPE_GAUGE));
  const feeDistributor = await ethers.getContractAt("FeeDistributor", FileUtils.getContractAddress(Constants.FeeDistributor));
  const gaugeFeeDistributor = await ethers.getContractAt("GaugeFeeDistributor", FileUtils.getContractAddress(Constants.GaugeFeeDistributor));
  const hopeSwapBurn = await ethers.getContractAt("HopeSwapBurner", FileUtils.getContractAddress(Constants.HopeSwapBurner));
  const underlyingBurner = await ethers.getContractAt("UnderlyingBurner", FileUtils.getContractAddress(Constants.UnderlyingBurner));
  const swapFeeToVault = await ethers.getContractAt("SwapFeeToVault", FileUtils.getContractAddress(Constants.SwapFeeToVault));
  const burnerManager = await ethers.getContractAt("BurnerManager", FileUtils.getContractAddress(Constants.BurnerManager));

  console.log("Transfer Onwership address: ");
  console.log(ltToken.address);
  console.log(veLight.address);
  console.log(gaugeController.address);
  console.log(gaugeFactory.address);
  console.log(smartWalletWhitelist.address);
  console.log(restricted.address);
  console.log(hope.address);
  console.log(stakingHope.address);
  console.log(feeDistributor.address);
  console.log(gaugeFeeDistributor.address);
  console.log(hopeSwapBurn.address);
  console.log(underlyingBurner.address);
  console.log(swapFeeToVault.address);
  console.log(burnerManager.address);


  await hope.transferOwnership(gnosisSafe);
  await gaugeController.transferOwnership(gnosisSafe);
  await restricted.transferOwnership(gnosisSafe);
  await ltToken.transferOwnership(gnosisSafe);
  await stakingHope.transferOwnership(gnosisSafe);
  await veLight.transferOwnership(gnosisSafe);
  await smartWalletWhitelist.transferOwnership(gnosisSafe);
  await gaugeFactory.transferOwnership(gnosisSafe);
  await swapFeeToVault.transferOwnership(gnosisSafe);
  await underlyingBurner.transferOwnership(gnosisSafe);
  await hopeSwapBurn.transferOwnership(gnosisSafe);
  await feeDistributor.transferOwnership(gnosisSafe);
  await gaugeFeeDistributor.transferOwnership(gnosisSafe);
  await gaugeFactory.setGaugeOwner(gnosisSafe);
  await burnerManager.transferOwnership(gnosisSafe);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});