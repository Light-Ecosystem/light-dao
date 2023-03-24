import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";
import { expect } from "chai";

async function main() {
  // todo
  const newOwnerAddress = "0x00";

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

  expect(await ltToken.pendingOwner()).to.equal(newOwnerAddress);
  expect(await veLight.pendingOwner()).to.equal(newOwnerAddress);
  expect(await gaugeController.pendingOwner()).to.equal(newOwnerAddress);
  expect(await gaugeFactory.pendingOwner()).to.equal(newOwnerAddress);
  expect(await smartWalletWhitelist.pendingOwner()).to.equal(newOwnerAddress);
  expect(await restricted.pendingOwner()).to.equal(newOwnerAddress);
  expect(await hope.pendingOwner()).to.equal(newOwnerAddress);
  expect(await stakingHope.pendingOwner()).to.equal(newOwnerAddress);
  expect(await feeDistributor.pendingOwner()).to.equal(newOwnerAddress);
  expect(await gaugeFeeDistributor.pendingOwner()).to.equal(newOwnerAddress);
  expect(await hopeSwapBurn.pendingOwner()).to.equal(newOwnerAddress);
  expect(await underlyingBurner.pendingOwner()).to.equal(newOwnerAddress);
  expect(await swapFeeToVault.pendingOwner()).to.equal(newOwnerAddress);
  expect(await burnerManager.pendingOwner()).to.equal(newOwnerAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});