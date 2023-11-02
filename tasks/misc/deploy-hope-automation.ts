import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";
import { waitForTx } from "../../helpers/tx";
import { ETH_MOCK_ADDRESS } from "../../helpers/constants";

task(
  `deploy-hope-automation`,
  `Deploys HOPE Automation Vault & Gateway`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const deployer = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";

  // 1. Set address first
  const HOPE_ADDRESS = "0xc353Bf07405304AeaB75F4C2Fac7E88D6A68f98e";
  const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const stETH_ADDRESS = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
  const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

  const ONE_INCH = "0x1111111254eeb25477b68fb85ed929f73a960582";
  const ZERO_EX = "0xdef1c0ded9bec7f1a1670819833240f027b25eff";
  const OKEX = "0x3b3ae790Df4F312e745D270119c6052904FB6790";
  const SWAP_WHITE_LISTED: string[] = [ONE_INCH, ZERO_EX, OKEX];

  // 2. Deloy Vault contract
  const Vault = await hre.ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(HOPE_ADDRESS, WBTC_ADDRESS, stETH_ADDRESS);
  await vault.deployed();
  console.log("- Vault deployed: ", vault.address);
  FileUtils.saveFrontendFiles(vault.address, "Vault", "Vault");

  // 3. Deploy Gateway contract
  const Gateway = await hre.ethers.getContractFactory("Gateway");
  const gateway = await Gateway.deploy(
    HOPE_ADDRESS,
    WBTC_ADDRESS,
    WETH_ADDRESS,
    stETH_ADDRESS,
    vault.address
  );
  await gateway.deployed();
  console.log("- Gateway deployed: ", gateway.address);
  FileUtils.saveFrontendFiles(gateway.address, "Gateway", "Gateway");

  // Configure vault gateway
  await waitForTx(await vault.updateGateway(gateway.address));
  console.log(`- [INFO] Gateway: ${gateway.address} config successful!`);

  // Grant deployer VaultManager role
  await waitForTx(await gateway.addVaultManager(deployer));

  // Update gateway supported tokens
  await waitForTx(
    await gateway.updateSupportTokens(
      [
        WBTC_ADDRESS,
        ETH_MOCK_ADDRESS,
        WETH_ADDRESS,
        stETH_ADDRESS,
        USDC_ADDRESS,
        USDT_ADDRESS,
        DAI_ADDRESS,
      ],
      [true, true, true, true, true, true, true]
    )
  );
  console.log(`- [INFO] Support tokens config successful!`);

  // Update swap white list
  if (SWAP_WHITE_LISTED.length > 0) {
    await waitForTx(
      await gateway.updateSwapWhiteLists(SWAP_WHITE_LISTED, [true, true, true])
    );
    console.log(`- [INFO] Swap white listed config successful!`);
  }
});
