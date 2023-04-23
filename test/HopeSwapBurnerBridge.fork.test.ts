import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("HopeSwapBurnerBridge", function() {
  const hopeAddress = "0xc353Bf07405304AeaB75F4C2Fac7E88D6A68f98e";
  const swapFeeToVaultAddress = "0xdA9C43a13A82b0D0292cF38E18Fa71a0a9F42f23";
  const burnerManagerAddress = "0x0d80a72c9F98e5b1C7Fb3e3dC4d58aecA5966066";
  const ltAddress = "0x9ed1439D328647BDb148c20316eA024c719a735b";
  const safeOnwerAddress = "0xC2D0108307Ff76eBb0ea05B78567b5eAF5AC7830";
  const routerAddress = "0x219Bd2d1449F3813c01204EE455D11B41D5051e9";

  const underlyingBurnerAddress = "0x77b3CFCd79F8030fAc267da519a1D8e4F6ee5F29";
  // https://etherscan.io/token/0x9ed1439D328647BDb148c20316eA024c719a735b#balances
  const LT_WHALE = "0x2314f8b81DFb2E3fD9fc085f6912641187d69cA3";


  async function deployOneYearLockFixture() {

    const [owner] = await ethers.getSigners();


    const safeOwner = await ethers.getImpersonatedSigner(safeOnwerAddress);
    const ltSigner = await ethers.getImpersonatedSigner(LT_WHALE);


    const HopeSwapBurnerBridge = await ethers.getContractFactory("HopeSwapBurnerBridge");
    const hopeSwapBurnerBridge = await HopeSwapBurnerBridge.deploy(hopeAddress, swapFeeToVaultAddress);
    await hopeSwapBurnerBridge.deployed();
    await hopeSwapBurnerBridge.setRouters([routerAddress]);

    const burnerManager = await ethers.getContractAt("BurnerManager", burnerManagerAddress);

    // send ETH to cover tx fee
    await owner.sendTransaction({ to: safeOnwerAddress, value: ethers.utils.parseEther("100") });
    await owner.sendTransaction({ to: LT_WHALE, value: ethers.utils.parseEther("100") });

    await burnerManager.connect(safeOwner).setBurner(ltAddress, hopeSwapBurnerBridge.address);
    const swapFeeToVault = await ethers.getContractAt("SwapFeeToVault", swapFeeToVaultAddress);

    // grant operator role to owner address
    await swapFeeToVault.connect(safeOwner).grantRole(await swapFeeToVault.OPERATOR_ROLE(), owner.address);

    const ltToken = await ethers.getContractAt("LT", ltAddress);
    const hopeToken = await ethers.getContractAt("HOPE", hopeAddress);

    return { swapFeeToVault, ltToken, hopeToken, ltSigner };
  }

  describe("Test SwapFeeToVault", function() {
    it("Should LT burnMany success", async function() {
      let latestBlock = await ethers.provider.getBlock("latest");
      // need fork Eth mainnet
      if (latestBlock.number > 17105943) {

        const { swapFeeToVault, ltToken, hopeToken, ltSigner } = await loadFixture(deployOneYearLockFixture);

        // Transfer few LT token to swapFeeToVault  contract address from whale account
        expect(await ltToken.balanceOf(ltSigner.address)).to.gt(ethers.utils.parseEther("1000"));
        await ltToken.connect(ltSigner).transfer(swapFeeToVaultAddress, ethers.utils.parseEther("1000"));
        console.log("before swapFeeToVault LT balance ", await ltToken.balanceOf(swapFeeToVaultAddress));
        expect(await ltToken.balanceOf(swapFeeToVaultAddress)).to.gt(ethers.constants.Zero);

        console.log("before underlyingBurner HOPE balance", await hopeToken.balanceOf(underlyingBurnerAddress));
        // burn Many
        await swapFeeToVault.burnMany([ltAddress], [0]);
        expect(await ltToken.balanceOf(swapFeeToVaultAddress)).to.equal(ethers.constants.Zero);
        console.log("after underlyingBurner HOPE balance", await hopeToken.balanceOf(underlyingBurnerAddress));
      } else {
        console.log("HopeSwapBurnerBridge need forking eth mainnet to execute this unit test ");
      }
    });
  });
});
