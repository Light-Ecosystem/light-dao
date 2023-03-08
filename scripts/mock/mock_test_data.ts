import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { FileUtils } from "../file_utils";
import { PermitSigHelper } from "../../test/PermitSigHelper";
import { Constants } from "../constant";


async function main() {
  const WEEK = 7 * 86400;
  const [owner] = await ethers.getSigners();

  // get address
  let permit2Address = FileUtils.getContractAddress(Constants.PERMIT2);
  let usdtAddress = FileUtils.getContractAddress(Constants.USDT_TOKEN);
  let hopeSalesAgentAddress = FileUtils.getContractAddress(Constants.TOKEN_SALE);
  let hopeAddress = FileUtils.getContractAddress(Constants.HOPE_TOKEN);

  let stakingHopeAddress = FileUtils.getContractAddress(Constants.STAKING_HOPE_GAUGE);
  let gaugeControllerAddress = FileUtils.getContractAddress(Constants.GAUGE_CONTROLLER);
  let veLTAddress = FileUtils.getContractAddress(Constants.VELT_TOKEN);
  let minterAddress = FileUtils.getContractAddress(Constants.LT_MINTER);
  let ltAddress = FileUtils.getContractAddress(Constants.LT_TOKEN);


  // load contract
  let usdtToken = await ethers.getContractAt("HOPE", usdtAddress);
  let hopeSalesAgent = await ethers.getContractAt("HOPESalesAgent", hopeSalesAgentAddress);
  let hopeToken = await ethers.getContractAt("HOPE", hopeAddress);

  let stakingHope = await ethers.getContractAt("StakingHope", stakingHopeAddress);
  let gaugeController = await ethers.getContractAt("GaugeController", gaugeControllerAddress);
  let veLT = await ethers.getContractAt("VotingEscrow", veLTAddress);
  let minter = await ethers.getContractAt("Minter", minterAddress);
  let light = await ethers.getContractAt("LT", ltAddress);


  await usdtToken.approve(permit2Address, ethers.constants.MaxUint256);

  let lastTime = Date.parse(new Date().toString()) / 100;
  let DEADLINE = lastTime + 60 * 60;
  let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
  let value = ethers.utils.parseEther("1000");
  let sig = await PermitSigHelper.signature(owner, usdtAddress, permit2Address, hopeSalesAgentAddress, value, NONCE, DEADLINE);
  console.log("balance of hope:", await hopeToken.balanceOf(owner.address));

  // buy hope
  await hopeSalesAgent.buy("USDT", value, NONCE, DEADLINE, sig);

  console.log("balance of hope:", await hopeToken.balanceOf(owner.address));

  // staking hope

  let stakingAmount = ethers.utils.parseEther("10000");
  lastTime = Date.parse(new Date().toString()) / 100;
  DEADLINE = lastTime + 60 * 60;
  NONCE = BigNumber.from(ethers.utils.randomBytes(32));
  await hopeToken.approve(permit2Address, stakingAmount);
  sig = await PermitSigHelper.signature(owner, hopeAddress, permit2Address, stakingHopeAddress, stakingAmount, NONCE, DEADLINE);
  await stakingHope.staking(stakingAmount, NONCE, DEADLINE, sig);

  // -- sleep some time
  await new Promise(res => setTimeout(() => res(null), 60000));

  // unstaking hope
  await stakingHope.unStaking(ethers.utils.parseEther("50"));

  // get LT can mint
  let integrateAmount = await stakingHope.integrateFraction(owner.address);
  console.log("integrate", integrateAmount);

  // minter LT

  console.log("balance of LT", await light.balanceOf(owner.address));
  await minter.mint(stakingHopeAddress);
  console.log("balance of LT", await light.balanceOf(owner.address));

  // veLT create lock (run only once)
  value = ethers.utils.parseEther("100000");
  await light.approve(veLT.address, value);
  lastTime = Date.parse(new Date().toString()) / 100;

  let lockTime = lastTime + WEEK * 52 * 2; //  2 years
  DEADLINE = lastTime + 60 * 60;
  NONCE = BigNumber.from(ethers.utils.randomBytes(32));
  sig = await PermitSigHelper.signature(owner, ltAddress, permit2Address, veLTAddress, value, NONCE, DEADLINE);
  await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

  // -- sleep some time
  await new Promise(res => setTimeout(() => res(null), 5000));

  // increase time
  value = ethers.utils.parseEther('100000');
  lastTime = Date.parse(new Date().toString()) / 100;

  DEADLINE = lastTime + 60 * 60;
  NONCE = BigNumber.from(ethers.utils.randomBytes(32));
  sig = await PermitSigHelper.signature(owner, ltAddress, permit2Address, veLTAddress, value, NONCE, DEADLINE);
  await veLT.increaseAmount(value, NONCE, DEADLINE, sig);
  // -- sleep some time
  await new Promise(res => setTimeout(() => res(null), 5000));

  console.log("---")


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});