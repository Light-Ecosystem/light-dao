import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";

task(`deploy-erc20-helpers`, `Deploys ERC20 helpers`)
  .addParam("symbol", "The ERC20 symbol")
  .addParam("userAllowd", "Daily limit per user")
  .addParam("totalAllowd", "Daily limit for all user")
  .addOptionalParam("decimal", "The ERC20 decimal")
  .setAction(async ({ symbol, decimal, userAllowd, totalAllowd }, hre) => {
    if (!hre.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }
    let faucetAddress = FileUtils.getContractAddress("Faucet");
    if (!faucetAddress) {
      await hre.run("deploy-faucet");
    }
    await hre.run("deploy-erc20", { symbol: symbol, decimal: decimal });
    await hre.run("setup-faucet-limit", {
      symbol: symbol,
      userAllowd: userAllowd,
      totalAllowd: totalAllowd,
    });
    await hre.run("verify-faucet-erc20", { symbol: symbol });
  });
