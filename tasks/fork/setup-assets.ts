import { task } from "hardhat/config";
import { ethers } from "ethers";
import { waitForTx } from "../../helpers/tx";
import { parseUnits } from "ethers/lib/utils";
import ERC20_ABI from "../../extendedArtifacts/ERC20.json";

const GANACHE_URL = process.env.GANACHE_URL || "";

task(`setup-assets`, `Setups Assets`).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const provider = new ethers.providers.JsonRpcProvider(GANACHE_URL);

  const RECEIVED_ADDRESS = "0xa676B1d841903A8d6010FB13A4f581aD26F7996E";

  const WBTC_HOLDER = "0x6daB3bCbFb336b29d06B9C793AEF7eaA57888922";
  const WETH_HOLDER = "0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3";
  const USDT_HOLDER = "0x461249076B88189f8AC9418De28B365859E46BfD";
  const USDC_HOLDER = "0xDa9CE944a37d218c3302F6B82a094844C6ECEb17";
  const DAI_HOLDER = "0x25B313158Ce11080524DcA0fD01141EeD5f94b81";
  // const stETH_HOLDER = "0x7153D2ef9F14a6b1Bb2Ed822745f65E58d836C3F";

  const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  // const stETH_ADDRESS = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";

  const TOKENS = [
    WBTC_ADDRESS,
    WETH_ADDRESS,
    USDT_ADDRESS,
    USDC_ADDRESS,
    DAI_ADDRESS,
    // stETH_ADDRESS,
  ];
  const SIGNERS = [
    provider.getSigner(WBTC_HOLDER),
    provider.getSigner(WETH_HOLDER),
    provider.getSigner(USDT_HOLDER),
    provider.getSigner(USDC_HOLDER),
    provider.getSigner(DAI_HOLDER),
    // provider.getSigner(stETH_HOLDER),
  ];
  const AMOUNTS = [
    parseUnits("500", 8),
    parseUnits("1000", 18),
    parseUnits("10000000", 6),
    parseUnits("10000000", 6),
    parseUnits("10000000", 18),
    // parseUnits("10000", 18),
  ];

  if (TOKENS.length != SIGNERS.length && TOKENS.length != AMOUNTS.length) {
    console.log("[ERROR] invalid array");
    return;
  }

  for (let i = 0; i < SIGNERS.length; i++) {
    const tokenContract = new ethers.Contract(TOKENS[i], ERC20_ABI, provider);
    await waitForTx(
      await tokenContract
        .connect(SIGNERS[i])
        .transfer(RECEIVED_ADDRESS, AMOUNTS[i])
    );
    console.log(
      `[INFO] Success received token: ${
        TOKENS[i]
      } ${await tokenContract.balanceOf(RECEIVED_ADDRESS)}`
    );
  }
});
