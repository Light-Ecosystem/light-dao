import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ZERO_ADDRESS } from "../helpers/constants";
import { parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";

describe("On-chain HOPE Automation Mint & Burn", () => {
  const CREDIT = parseUnits("5000", 18);
  let agentBlock: number;

  const K: number = 10801805;
  const K_FACTOR: number = 1e12;
  const ETH_TO_BTC_RATIO: number = 10;

  function calculateReserveAmount(
    _hopeAmount: BigNumber
  ): [BigNumber, BigNumber] {
    const wbtcConversionFactor: BigNumber = parseUnits("1", 18).div(
      parseUnits("1", 8)
    );
    const wbtcAmount: BigNumber = _hopeAmount
      .mul(K)
      .div(K_FACTOR)
      .div(wbtcConversionFactor);
    const ethAmount: BigNumber = wbtcAmount
      .mul(wbtcConversionFactor)
      .mul(ETH_TO_BTC_RATIO);

    return [wbtcAmount, ethAmount];
  }

  async function deployVaultFixture() {
    const [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
    const RestrictedList = await ethers.getContractFactory("RestrictedList");
    const restrictedList = await RestrictedList.deploy();

    const HOPE = await ethers.getContractFactory("HOPE");
    const hope = await upgrades.deployProxy(HOPE, [restrictedList.address]);
    await hope.deployed();

    const WBTC = await ethers.getContractFactory("MintableERC20");
    const wbtc = await WBTC.deploy("WBTC", "WBTC", 8, ZERO_ADDRESS);

    const USDT = await ethers.getContractFactory("MintableERC20");
    const usdt = await USDT.deploy("USDT", "USDT", 6, ZERO_ADDRESS);

    const StETH = await ethers.getContractFactory("StETH");
    const stETH = await StETH.deploy();

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(hope.address, wbtc.address, stETH.address);

    agentBlock = await ethers.provider.getBlockNumber();

    return {
      owner,
      addr1,
      addr2,
      addr3,
      hope,
      wbtc,
      stETH,
      usdt,
      vault,
    };
  }

  describe("HOPE automation mint & burn", () => {
    describe("Mint", async () => {
      it("should revert not gateway deposit", async () => {
        const { owner, vault } = await loadFixture(deployVaultFixture);
        await expect(vault.deposit(owner.address, 1)).to.revertedWith("VA000");
      });
      it("should revert not agent role", async () => {
        const { owner, vault } = await loadFixture(deployVaultFixture);
        // Mock Gateway
        await vault.updateGateway(owner.address);

        await expect(vault.deposit(owner.address, 1)).to.revertedWith("AG000");
      });
      it("should revert not mintable", async () => {
        const { owner, hope, vault } = await loadFixture(deployVaultFixture);
        // Mock Gateway
        await vault.updateGateway(owner.address);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          false,
          true
        );

        await expect(vault.deposit(owner.address, 1)).to.revertedWith("AG002");
      });
      it("should revert exceed credit", async () => {
        const { owner, hope, vault } = await loadFixture(deployVaultFixture);
        // Mock Gateway
        await vault.updateGateway(owner.address);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          true
        );

        await expect(
          vault.deposit(owner.address, CREDIT.add(BigNumber.from("1")))
        ).to.revertedWith("AG004");
      });
      it("mint success", async () => {
        const { owner, hope, vault } = await loadFixture(deployVaultFixture);
        // Mock Gateway
        await vault.updateGateway(owner.address);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          true
        );
        const mintAmount = parseUnits("100", 18);
        await vault.deposit(owner.address, mintAmount);
        expect(await vault.totalMinted()).to.be.equal(mintAmount);
        expect(await hope.balanceOf(owner.address)).to.be.equal(mintAmount);
        expect(await hope.balanceOf(vault.address)).to.be.equal(0);
        expect(await hope.getRemainingCredit(vault.address)).to.be.equal(
          CREDIT.sub(mintAmount)
        );
      });
    });

    describe("Burn", async () => {
      it("should revert not gateway deposit", async () => {
        const { vault } = await loadFixture(deployVaultFixture);
        await expect(vault.withdraw(1)).to.revertedWith("VA000");
      });
      it("should revert not burnable", async () => {
        const { owner, hope, vault } = await loadFixture(deployVaultFixture);
        // Mock Gateway
        await vault.updateGateway(owner.address);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          false
        );
        await vault.deposit(vault.address, 1);
        await expect(vault.withdraw(1)).to.revertedWith("AG003");
      });
      it("should revert exceed credit", async () => {
        const { owner, hope, vault } = await loadFixture(deployVaultFixture);
        // Mock Gateway
        await vault.updateGateway(owner.address);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          true
        );

        await vault.deposit(vault.address, CREDIT);

        await expect(
          vault.withdraw(CREDIT.add(BigNumber.from("1")))
        ).to.revertedWithPanic();
      });
      it("burn success", async () => {
        const { owner, hope, vault } = await loadFixture(deployVaultFixture);
        // Mock Gateway
        await vault.updateGateway(owner.address);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          true
        );
        const mintAmount = parseUnits("100", 18);
        await vault.deposit(vault.address, mintAmount);
        const burnAmount = parseUnits("49", 18);
        await vault.withdraw(burnAmount);
        expect(await vault.totalMinted()).to.be.equal(
          mintAmount.sub(burnAmount)
        );
        expect(await hope.balanceOf(vault.address)).to.be.equal(
          mintAmount.sub(burnAmount)
        );
        expect(await hope.getRemainingCredit(vault.address)).to.be.equal(
          CREDIT.sub(mintAmount).add(burnAmount)
        );
      });
    });

    describe("Pause", () => {
      it("mint should revert when paused", async () => {
        const { owner, addr1, vault } = await loadFixture(deployVaultFixture);
        await vault.updateGateway(owner.address);
        await vault.addVaultManager(addr1.address);
        await vault.connect(addr1).pause();
        await expect(vault.deposit(owner.address, 1)).to.revertedWith(
          "Pausable: paused"
        );
      });
      it("burn should revert when paused", async () => {
        const { hope, owner, addr1, vault } = await loadFixture(
          deployVaultFixture
        );
        await vault.updateGateway(owner.address);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          true
        );
        const mintAmount = parseUnits("100", 18);
        await vault.deposit(vault.address, mintAmount);

        await vault.addVaultManager(addr1.address);
        await vault.connect(addr1).pause();
        await expect(vault.withdraw(1)).to.revertedWith("Pausable: paused");
      });
    });
    describe("Transfer ERC20 Token", () => {
      it("transfer should revert not gateway", async () => {
        const { wbtc, owner, addr1, vault } = await loadFixture(
          deployVaultFixture
        );
        await expect(
          vault.safeTransferToken(wbtc.address, addr1.address, 1)
        ).to.revertedWith("VA000");
      });
      it("transfer token", async () => {
        const { wbtc, owner, addr1, vault } = await loadFixture(
          deployVaultFixture
        );
        await wbtc["mint(address,uint256)"](vault.address, 1);

        await vault.updateGateway(owner.address);
        await vault.safeTransferToken(wbtc.address, addr1.address, 1);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(0);
        expect(await wbtc.balanceOf(addr1.address)).to.be.equal(1);
      });
    });

    describe("mint with fee", () => {
      it("update fee rate will revert", async () => {
        const { owner, addr1, vault } = await loadFixture(deployVaultFixture);
        const mintFeeRate = parseUnits("0.1", 6);
        await expect(vault.updateMintFeeRate(mintFeeRate)).to.revertedWith(
          "VA004"
        );
      });
      it("mint success", async () => {
        const { owner, hope, vault } = await loadFixture(deployVaultFixture);
        // Mock Gateway
        await vault.updateGateway(owner.address);

        const mintFeeRate = parseUnits("0.099999", 6);
        await vault.updateMintFeeRate(mintFeeRate);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          true
        );
        const mintAmount = parseUnits("100", 18);
        await vault.deposit(owner.address, mintAmount);

        const fee = mintAmount.mul(mintFeeRate).div(parseUnits("1", 6));

        expect(await vault.totalMinted()).to.be.equal(mintAmount);
        expect(await hope.balanceOf(owner.address)).to.be.equal(
          mintAmount.sub(fee)
        );
        expect(await hope.balanceOf(vault.address)).to.be.equal(fee);
        expect(await hope.getRemainingCredit(vault.address)).to.be.equal(
          CREDIT.sub(mintAmount)
        );
      });
    });

    describe("burn with fee", () => {
      it("update fee rate will revert", async () => {
        const { owner, addr1, vault } = await loadFixture(deployVaultFixture);
        const burnFeeRate = parseUnits("0.1", 6);
        await expect(vault.updateMintFeeRate(burnFeeRate)).to.revertedWith(
          "VA004"
        );
      });
      it("burn success", async () => {
        const { owner, hope, vault } = await loadFixture(deployVaultFixture);
        // Mock Gateway
        await vault.updateGateway(owner.address);

        const burnFeeRate = parseUnits("0.099999", 6);
        await vault.updateBurnFeeRate(burnFeeRate);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          true
        );
        const mintAmount = parseUnits("100", 18);
        await vault.deposit(vault.address, mintAmount);
        await vault.withdraw(mintAmount);

        const fee = mintAmount.mul(burnFeeRate).div(parseUnits("1", 6));

        expect(await vault.totalMinted()).to.be.equal(fee);
        expect(await hope.balanceOf(vault.address)).to.be.equal(fee);
        expect(await hope.getRemainingCredit(vault.address)).to.be.equal(
          CREDIT.sub(mintAmount).add(mintAmount).sub(fee)
        );
      });
    });

    describe("Claim", () => {
      it("claim fee will revert not vault manager", async () => {
        const { owner, addr1, hope, vault } = await loadFixture(
          deployVaultFixture
        );
        // Mock Gateway
        await vault.updateGateway(owner.address);
        await expect(vault.claimHOPE(owner.address)).to.reverted;
      });
      it("claim fee", async () => {
        const { owner, addr1, hope, vault } = await loadFixture(
          deployVaultFixture
        );
        // Mock Gateway
        await vault.updateGateway(owner.address);

        await vault.addVaultManager(addr1.address);

        const mintFeeRate = parseUnits("0.099999", 6);
        await vault.updateMintFeeRate(mintFeeRate);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          true
        );
        const mintAmount = parseUnits("100", 18);
        await vault.deposit(owner.address, mintAmount);

        const fee = mintAmount.mul(mintFeeRate).div(parseUnits("1", 6));

        expect(await vault.totalMinted()).to.be.equal(mintAmount);
        expect(await hope.balanceOf(owner.address)).to.be.equal(
          mintAmount.sub(fee)
        );
        expect(await hope.balanceOf(vault.address)).to.be.equal(fee);

        expect(await vault.claimableHOPE()).to.be.equal(fee);
        await vault.connect(addr1).claimHOPE(addr1.address);

        expect(await hope.balanceOf(vault.address)).to.be.equal(0);
        expect(await vault.claimableHOPE()).to.be.equal(0);
        expect(await hope.balanceOf(addr1.address)).to.be.equal(fee);
      });
      it("claim stETH will revert not vault manager", async () => {
        const { owner, addr1, hope, vault } = await loadFixture(
          deployVaultFixture
        );
        // Mock Gateway
        await vault.updateGateway(owner.address);
        await expect(vault.claimStETH(owner.address)).to.reverted;
      });
      it("claim stETH", async () => {
        const { owner, addr1, hope, stETH, vault } = await loadFixture(
          deployVaultFixture
        );
        // Mock Gateway
        await vault.updateGateway(owner.address);
        await vault.addVaultManager(addr1.address);

        await hope.grantAgent(
          vault.address,
          CREDIT,
          agentBlock,
          agentBlock + 1000,
          true,
          true
        );

        const stakedAmount = parseUnits("1", 18);
        await vault.stakeETH({ value: stakedAmount });

        const mintAmount = parseUnits("5000", 18);
        await vault.deposit(owner.address, mintAmount);

        const [, totalETHReserve] = calculateReserveAmount(mintAmount);

        // Mock Lido rewards
        await stETH.receiveRewards({ value: parseUnits("0.2", 18) });

        const stETHBalance = await stETH.balanceOf(vault.address);

        expect(await vault.claimableStETH()).to.equal(
          stETHBalance.sub(totalETHReserve)
        );

        await vault.connect(addr1).claimStETH(addr1.address);

        expect(await vault.claimableStETH()).to.be.equal(0);
        // Ignore minimal error caused by the Share Token transfer process
        expect(await stETH.balanceOf(addr1.address)).to.closeTo(
          stETHBalance.sub(totalETHReserve),
          1
        );
      });
    });
  });
});
