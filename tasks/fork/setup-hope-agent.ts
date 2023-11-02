import { task } from "hardhat/config";
import { ethers } from "ethers";
import { waitForTx } from "../../helpers/tx";
import { parseUnits } from "ethers/lib/utils";

const GANACHE_URL = process.env.GANACHE_URL || "";

task(`setup-hope-agent`, `Setups HOPE agent role`).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const provider = new ethers.providers.JsonRpcProvider(GANACHE_URL);

  const HOPE_ADDRESS = "0xc353Bf07405304AeaB75F4C2Fac7E88D6A68f98e";
  const SAFE_OWNER = "0xC2D0108307Ff76eBb0ea05B78567b5eAF5AC7830";
  const VAULT_ADDRESS = "0x7DFfB34cA18C5ae958E402622225777341ee35Eb";

  const safeSigner = provider.getSigner(SAFE_OWNER);

  const HOPE_ABI = [
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "credit",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "effectiveBlock",
          type: "uint256",
        },
        {
          internalType: "uint256",
          name: "expirationBlock",
          type: "uint256",
        },
        {
          internalType: "bool",
          name: "minable",
          type: "bool",
        },
        {
          internalType: "bool",
          name: "burnable",
          type: "bool",
        },
      ],
      name: "grantAgent",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address",
        },
      ],
      name: "hasAgent",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];

  const hope = new ethers.Contract(HOPE_ADDRESS, HOPE_ABI, provider);

  await waitForTx(
    await hope
      .connect(safeSigner)
      .grantAgent(
        VAULT_ADDRESS,
        parseUnits("400000000", 18),
        1,
        99999999999,
        true,
        true
      )
  );

  const isAgent = await hope.hasAgent(VAULT_ADDRESS);
  if (isAgent) {
    console.log("[INFO] Agent grant successful!");
  }
});
