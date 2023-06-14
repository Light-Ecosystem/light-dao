import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";
import { waitForTx } from "../../helpers/tx";

task(`setup-vault-operator`, `Setups FeeToVault operator`).setAction(
  async (_, hre) => {
    if (!hre.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }
    // 1. Set operator address first
    const operator = "0x00";
    // 2. Grant FeeToVault operator
    let feeToVaultAddress = FileUtils.getContractAddress(Constants.FeeToVault);
    const feeToVault = await hre.ethers.getContractAt(
      "FeeToVault",
      feeToVaultAddress
    );
    await waitForTx(await feeToVault.addOperator(operator));
    const isGrantOperator = await feeToVault.isOperator(operator);
    if (isGrantOperator) {
      console.log(`- Successfully grant operator (${operator}) to FeeToVault`);
    }
  }
);
