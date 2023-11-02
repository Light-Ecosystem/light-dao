import { task } from "hardhat/config";
import { ethers } from "ethers";
import { waitForTx } from "../../helpers/tx";
import { parseUnits } from "ethers/lib/utils";

const GANACHE_URL = process.env.GANACHE_URL || "";

task(`upgrade-fee-distributor`, `Upgrade FeeDistributor`).setAction(
  async (_, hre) => {
    if (!hre.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }

    const provider = new ethers.providers.JsonRpcProvider(GANACHE_URL);

    const PROXY_ADMIN_ADDRESS = "0xcc0f986021010D4A3345CCA903BF5487AEa3bd39";
    const SAFE_OWNER = "0xC2D0108307Ff76eBb0ea05B78567b5eAF5AC7830";
    const FEE_DISTRIBUTOR_ADDRESS =
      "0x99040c96bb8D931c29b2a9B91Dcfcd36162BB697";
    const GAUGE_FEE_DISTRIBUTOR_ADDRESS =
      "0xE0530d1261802eb32908b72574F9a6362C898a84";

    const safeSigner = provider.getSigner(SAFE_OWNER);

    const PROXY_ADMIN_ABI = [
      {
        inputs: [
          {
            internalType: "contract TransparentUpgradeableProxy",
            name: "proxy",
            type: "address",
          },
          {
            internalType: "address",
            name: "implementation",
            type: "address",
          },
        ],
        name: "upgrade",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ];

    const proxyAdmin = new ethers.Contract(
      PROXY_ADMIN_ADDRESS,
      PROXY_ADMIN_ABI,
      provider
    );

    const FeeDistributor = await hre.ethers.getContractFactory(
      "FeeDistributor"
    );
    const feeDistributor = await FeeDistributor.deploy();
    await feeDistributor.deployed();

    const GaugeFeeDistributor = await hre.ethers.getContractFactory(
      "GaugeFeeDistributor"
    );
    const gaugeFeeDistributor = await GaugeFeeDistributor.deploy();
    await gaugeFeeDistributor.deployed();

    console.log(feeDistributor.address);
    console.log(gaugeFeeDistributor.address);

    await waitForTx(
      await proxyAdmin
        .connect(safeSigner)
        .upgrade(FEE_DISTRIBUTOR_ADDRESS, feeDistributor.address)
    );

    await waitForTx(
      await proxyAdmin
        .connect(safeSigner)
        .upgrade(GAUGE_FEE_DISTRIBUTOR_ADDRESS, gaugeFeeDistributor.address)
    );

    console.log("[INFO] Upgrade successful!");
  }
);
