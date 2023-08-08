import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
task(`deploy-erc20`, `Deploys mock erc20`)
  .addParam("symbol", "The ERC20 symbol")
  .addOptionalParam("decimal", "The ERC20 decimal")
  .setAction(async ({ symbol, decimal }, hre) => {
    if (!hre.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }
    let faucetAddress = FileUtils.getContractAddress("Faucet");
    if (!faucetAddress) {
      console.log("[Error] Faucet address empty!");
      return;
    }
    if (symbol == "WETH") {
      const WETH9Mocked = await hre.ethers.getContractFactory("WETH9Mocked");
      const wETH9Mocked = await WETH9Mocked.deploy(faucetAddress);
      await wETH9Mocked.deployed();
      console.log(`- ${symbol} deployed: `, wETH9Mocked.address);
      FileUtils.saveFrontendFiles(wETH9Mocked.address, "WETH9Mocked", symbol);
    } else {
      const MintableERC20 = await hre.ethers.getContractFactory(
        "MintableERC20"
      );
      const mintableERC20 = await MintableERC20.deploy(
        symbol,
        symbol,
        decimal == null ? 18 : decimal,
        faucetAddress
      );
      await mintableERC20.deployed();
      console.log(`- ${symbol} deployed: `, mintableERC20.address);
      FileUtils.saveFrontendFiles(
        mintableERC20.address,
        "MintableERC20",
        symbol
      );
    }
  });
