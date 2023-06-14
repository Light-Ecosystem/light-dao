import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";
import { waitForTx } from "../../helpers/tx";

task(
  `transfer-fee-ownership`,
  `Transfer FeeToVault & SwapBurner ownership`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }
  // 1. Define multi sig address
  const multiSig = "0x00";
  // 2. Transfer ownership
  const feeToVaultAddress = FileUtils.getContractAddress(Constants.FeeToVault);
  const feeToVault = await hre.ethers.getContractAt(
    "FeeToVault",
    feeToVaultAddress
  );
  const swapBurnerAddress = FileUtils.getContractAddress(Constants.SwapBurner);
  const swapBurner = await hre.ethers.getContractAt(
    "SwapBurner",
    swapBurnerAddress
  );
  await waitForTx(await feeToVault.transferOwnership(multiSig));
  await waitForTx(await swapBurner.transferOwnership(multiSig));
  const feeToVaultPending = (await feeToVault.pendingOwner()) === multiSig;
  const swapBurnerPending = (await feeToVault.pendingOwner()) === multiSig;
  if (feeToVaultPending && swapBurnerPending) {
    console.log(
      `- Successfully transfer ownership step 1, pending owner is (${multiSig})`
    );
    console.log("- Pending multisig accept ownership......");
  }
});
