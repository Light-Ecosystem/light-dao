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
  const HOPE_ADDRESS = "0x70C8C67CfbE228c7437Ec586a751a408e23355F4";
  const WBTC_ADDRESS = "0xAF48F7c5866c0Fd63492bAc0b7816c1933c4D43a";
  const WETH_ADDRESS = "0xE55a23aaFb3a712BFae5BE96E0f61C745dedf33C";
  const stETH_ADDRESS = "0x00c71b0fCadE911B2feeE9912DE4Fe19eB04ca56";
  const USDT_ADDRESS = "0x76127399A0CafeDB59615A93A7ACF8552c1aEE4c";
  const USDC_ADDRESS = "0x06446E7Bd1f211C3189cfeCF3CDE488757eb5e4f";
  const DAI_ADDRESS = "0xAd4979AE4a275c4f6bc194c14C3b3CFBcD435abb";

  const SWAP_WHITE_LISTED: string[] = [];

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
      await gateway.updateSwapWhiteLists(SWAP_WHITE_LISTED, [true])
    );
    console.log(`- [INFO] Swap white listed config successful!`);
  }
});
