import { ContractTransaction } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

declare var hre: HardhatRuntimeEnvironment;

export const waitForTx = async (tx: ContractTransaction) => await tx.wait(1);

export const getCurrentBlock = async () => {
  return (await hre.ethers.provider.getBlock("latest")).number;
};

export const evmSnapshot = async () =>
  await hre.ethers.provider.send("evm_snapshot", []);

export const evmRevert = async (id: string) =>
  hre.ethers.provider.send("evm_revert", [id]);

export const advanceBlock = async (timestamp: number) =>
  await hre.ethers.provider.send("evm_mine", [timestamp]);

export const increaseTime = async (secondsToIncrease: number) => {
  await hre.ethers.provider.send("evm_increaseTime", [secondsToIncrease]);
  await hre.ethers.provider.send("evm_mine", []);
};

// Workaround for time travel tests bug: https://github.com/Tonyhaenn/hh-time-travel/blob/0161d993065a0b7585ec5a043af2eb4b654498b8/test/test.js#L12
export const advanceTimeAndBlock = async function (forwardTime: number) {
  const currentBlockNumber = await getCurrentBlock();
  const currentBlock = await hre.ethers.provider.getBlock(currentBlockNumber);

  if (currentBlock === null) {
    /* Workaround for https://github.com/nomiclabs/hardhat/issues/1183
     */
    await hre.ethers.provider.send("evm_increaseTime", [forwardTime]);
    await hre.ethers.provider.send("evm_mine", []);
    //Set the next blocktime back to 15 seconds
    await hre.ethers.provider.send("evm_increaseTime", [15]);
    return;
  }
  const currentTime = currentBlock.timestamp;
  const futureTime = currentTime + forwardTime;
  await hre.ethers.provider.send("evm_setNextBlockTimestamp", [futureTime]);
  await hre.ethers.provider.send("evm_mine", []);
};
