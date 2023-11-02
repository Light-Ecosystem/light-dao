import { task } from "hardhat/config";
import { ethers } from "ethers";
import { waitForTx } from "../../helpers/tx";
import { parseUnits } from "ethers/lib/utils";

const GANACHE_WALLET_KEY = process.env.GANACHE_WALLET_KEY || "";
const GANACHE_URL = process.env.GANACHE_URL || "";

task(`setup-eoa-gas`, `Setups EOA Gas`).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const provider = new ethers.providers.JsonRpcProvider(GANACHE_URL);

  const DEPLOYER = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
  const SAFE_OWNER = "0xC2D0108307Ff76eBb0ea05B78567b5eAF5AC7830";
  const WBTC_HOLDER = "0x6daB3bCbFb336b29d06B9C793AEF7eaA57888922";
  const WETH_HOLDER = "0x2fEb1512183545f48f6b9C5b4EbfCaF49CfCa6F3";
  const USDT_HOLDER = "0x461249076B88189f8AC9418De28B365859E46BfD";
  const USDC_HOLDER = "0xDa9CE944a37d218c3302F6B82a094844C6ECEb17";
  const DAI_HOLDER = "0x25B313158Ce11080524DcA0fD01141EeD5f94b81";
  const ST_ETH_HOLDER = "0x7153D2ef9F14a6b1Bb2Ed822745f65E58d836C3F";

  const GASER = [
    DEPLOYER,
    SAFE_OWNER,
    WBTC_HOLDER,
    WETH_HOLDER,
    USDT_HOLDER,
    USDC_HOLDER,
    DAI_HOLDER,
    ST_ETH_HOLDER,
  ];

  const owner = new ethers.Wallet(GANACHE_WALLET_KEY, provider);

  for (let i = 0; i < GASER.length; i++) {
    await waitForTx(
      await owner.sendTransaction({
        to: GASER[i],
        value: parseUnits("1", 18),
      })
    );
  }
});
