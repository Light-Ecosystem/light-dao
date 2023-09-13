import { ethers, upgrades, config } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
  ETH_MOCK_ADDRESS,
  MAX_UINT_AMOUNT,
  ONE_ADDRESS,
  ONE_HOUR,
  ZERO_ADDRESS,
} from "../helpers/constants";
import { parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";
import { waitForTx } from "../helpers/tx";
import { buildPermitParams, getSignatureFromTypedData } from "./SigHelper";

describe("On-chain HOPE Automation Mint & Burn", () => {
  const CREDIT = parseUnits("4000000", 18);
  let agentBlock: number;

  const accounts = config.networks.hardhat.accounts;
  const index = 1; // first wallet, increment for next wallets
  const wallet1 = ethers.Wallet.fromMnemonic(
    accounts.mnemonic,
    accounts.path + `/${index}`
  );

  const K: number = 10801805;
  const K_FACTOR: number = 1e12;
  const ETH_TO_BTC_RATIO: number = 10;

  const initialWBTCBalance = parseUnits("10", 8);
  const initialWETHBalance = parseUnits("100", 18);
  const initialStETHBalance = parseUnits("2", 18);
  const initialUSDTBalance = parseUnits("10000", 6);
  const initialUSDCBalance = parseUnits("10000", 6);
  const initialDAIBalance = parseUnits("10000", 18);

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

  async function deployGatewayFixture() {
    const [owner, alice, bob, addr3, ...addrs] = await ethers.getSigners();
    const RestrictedList = await ethers.getContractFactory("RestrictedList");
    const restrictedList = await RestrictedList.deploy();

    const HOPE = await ethers.getContractFactory("HOPE");
    const hope = await upgrades.deployProxy(HOPE, [restrictedList.address]);
    await hope.deployed();

    const WBTC = await ethers.getContractFactory("MintableERC20");
    const wbtc = await WBTC.deploy("WBTC", "WBTC", 8, ZERO_ADDRESS);

    const WETH = await ethers.getContractFactory("WETH9Mocked");
    const weth = await WETH.deploy(ZERO_ADDRESS);

    const USDT = await ethers.getContractFactory("MintableERC20");
    const usdt = await USDT.deploy("USDT", "USDT", 6, ZERO_ADDRESS);

    const USDC = await ethers.getContractFactory("MintableERC20");
    const usdc = await USDC.deploy("USDC", "USDC", 6, ZERO_ADDRESS);

    const DAI = await ethers.getContractFactory("MintableERC20");
    const dai = await DAI.deploy("DAI", "DAI", 18, ZERO_ADDRESS);

    const StETH = await ethers.getContractFactory("StETH");
    const stETH = await StETH.deploy();

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(hope.address, wbtc.address, stETH.address);

    const Gateway = await ethers.getContractFactory("Gateway");
    const gateway = await Gateway.deploy(
      hope.address,
      wbtc.address,
      weth.address,
      stETH.address,
      vault.address
    );

    agentBlock = await ethers.provider.getBlockNumber();

    await waitForTx(await vault.updateGateway(gateway.address));
    await waitForTx(
      await hope.grantAgent(
        vault.address,
        CREDIT,
        agentBlock,
        agentBlock + 1000,
        true,
        true
      )
    );
    // Init asset
    await waitForTx(
      await wbtc["mint(address,uint256)"](alice.address, initialWBTCBalance)
    );
    await waitForTx(
      await weth.connect(alice).deposit({ value: initialWETHBalance })
    );
    await waitForTx(
      await stETH
        .connect(alice)
        .submit(ZERO_ADDRESS, { value: initialStETHBalance })
    );
    await waitForTx(
      await usdt["mint(address,uint256)"](alice.address, initialUSDTBalance)
    );
    await waitForTx(
      await usdc["mint(address,uint256)"](alice.address, initialUSDCBalance)
    );
    await waitForTx(
      await dai["mint(address,uint256)"](alice.address, initialDAIBalance)
    );
    return {
      owner,
      alice,
      bob,
      addr3,
      hope,
      wbtc,
      weth,
      stETH,
      usdt,
      usdc,
      dai,
      vault,
      gateway,
    };
  }

  describe("HOPE automation mint & burn", () => {
    describe("Deposit", async () => {
      it("mint will revert not support deposit token", async () => {
        const { alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);
        const mintAmount = parseUnits("7503.15", 18);

        await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT);

        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);

        await expect(
          gateway.connect(alice).combinationDeposit(mintAmount, ONE_ADDRESS)
        ).to.revertedWith("GW000");
      });
      it("mint will revert when amount too low", async () => {
        const { alice, wbtc, gateway } = await loadFixture(
          deployGatewayFixture
        );
        const mintAmount = parseUnits("0.0009", 18);

        await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT);

        await expect(
          gateway
            .connect(alice)
            .combinationDeposit(mintAmount, ETH_MOCK_ADDRESS)
        ).to.revertedWith("GW010");
      });
      it("mint with deposit wbtc & eth", async () => {
        const { alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);
        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);

        const aliceEthBalanceBefore = await alice.getBalance();

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, ETH_MOCK_ADDRESS, {
              value: ethAmount,
            })
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(wbtcAmount);
        expect(await stETH.balanceOf(vault.address)).to.be.equal(ethAmount);
        expect(await wbtc.balanceOf(alice.address)).to.be.equal(
          initialWBTCBalance.sub(wbtcAmount)
        );
        // Gas cost
        expect(await alice.getBalance()).to.be.closeTo(
          aliceEthBalanceBefore.sub(ethAmount),
          parseUnits("0.0005", 18)
        );
      });
      it("mint with deposit wbtc & weth", async () => {
        const { alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);

        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await weth.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, weth.address)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(wbtcAmount);
        expect(await stETH.balanceOf(vault.address)).to.be.equal(ethAmount);
        expect(await wbtc.balanceOf(alice.address)).to.be.equal(
          initialWBTCBalance.sub(wbtcAmount)
        );
        expect(await weth.balanceOf(alice.address)).to.be.equal(
          initialWETHBalance.sub(ethAmount)
        );
      });
      it("mint with deposit wbtc & stETH", async () => {
        const { alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);

        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await stETH.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, stETH.address)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(wbtcAmount);
        expect(await stETH.balanceOf(vault.address)).to.be.equal(ethAmount);
        expect(await wbtc.balanceOf(alice.address)).to.be.equal(
          initialWBTCBalance.sub(wbtcAmount)
        );
        expect(await stETH.balanceOf(alice.address)).to.be.equal(
          initialStETHBalance.sub(ethAmount)
        );
      });
      it("mint with deposit wbtc & weth has mint fee", async () => {
        const { alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);

        const mintFeeRate = parseUnits("0.099999", 6);
        await waitForTx(await vault.updateMintFeeRate(mintFeeRate));

        const mintAmount = parseUnits("7503.15", 18);
        const fee = mintAmount.mul(mintFeeRate).div(parseUnits("1", 6));

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await weth.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, weth.address)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(
          mintAmount.sub(fee)
        );
        expect(await hope.balanceOf(vault.address)).to.be.equal(fee);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(wbtcAmount);
        expect(await stETH.balanceOf(vault.address)).to.be.equal(ethAmount);
        expect(await wbtc.balanceOf(alice.address)).to.be.equal(
          initialWBTCBalance.sub(wbtcAmount)
        );
        expect(await weth.balanceOf(alice.address)).to.be.equal(
          initialWETHBalance.sub(ethAmount)
        );
      });
    });
    describe("Withdraw", async () => {
      it("burn will revert when amount too low", async () => {
        const { owner, alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);

        const mintAmount = parseUnits("1", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await stETH.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, stETH.address)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);

        await hope.connect(alice).approve(gateway.address, mintAmount);

        const burnAmount = parseUnits("0.0009", 18);

        await expect(
          gateway.connect(alice).combinationWithdraw(burnAmount)
        ).to.revertedWith("GW010");
      });
      it("burn with withdraw wbtc & stETH", async () => {
        const { owner, alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);

        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await stETH.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, stETH.address)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);

        await hope.connect(alice).approve(gateway.address, mintAmount);
        await waitForTx(
          await gateway.connect(alice).combinationWithdraw(mintAmount)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(0);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(0);
        expect(await stETH.balanceOf(vault.address)).to.be.equal(0);
        expect(await wbtc.balanceOf(alice.address)).to.be.equal(
          initialWBTCBalance
        );
        expect(await stETH.balanceOf(alice.address)).to.be.equal(
          initialStETHBalance
        );
      });
      it("permit burn with withdraw wbtc & stETH", async () => {
        const { alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);

        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await stETH.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, stETH.address)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);

        const chainId = (await ethers.provider.getNetwork()).chainId;
        const deadline = (await time.latest()) + ONE_HOUR;
        const nonce = (await hope.nonces(alice.address)).toNumber();
        const msgParams = buildPermitParams(
          chainId,
          hope.address,
          "1",
          await hope.name(),
          alice.address,
          gateway.address,
          nonce,
          deadline.toString(),
          mintAmount.toString()
        );

        const alicePrivateKey = wallet1.privateKey;

        const { v, r, s } = getSignatureFromTypedData(
          alicePrivateKey,
          msgParams
        );

        // await hope.connect(alice).approve(gateway.address, mintAmount);
        await waitForTx(
          await gateway
            .connect(alice)
            .combinationWithdrawWithPermit(mintAmount, deadline, v, r, s)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(0);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(0);
        expect(await stETH.balanceOf(vault.address)).to.be.equal(0);
        expect(await wbtc.balanceOf(alice.address)).to.be.equal(
          initialWBTCBalance
        );
        expect(await stETH.balanceOf(alice.address)).to.be.equal(
          initialStETHBalance
        );
      });
      it("burn with withdraw wbtc & stETH has burn fee", async () => {
        const { alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);

        const burnFeeRate = parseUnits("0.099999", 6);
        await waitForTx(await vault.updateBurnFeeRate(burnFeeRate));

        const mintAmount = parseUnits("7503.15", 18);
        const fee = mintAmount.mul(burnFeeRate).div(parseUnits("1", 6));

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await weth.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const [, ethAmount] = calculateReserveAmount(mintAmount);
        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, weth.address)
        );

        expect(await weth.balanceOf(alice.address)).to.be.equal(
          initialWETHBalance.sub(ethAmount)
        );

        await waitForTx(
          await hope.connect(alice).approve(gateway.address, mintAmount)
        );
        await waitForTx(
          await gateway.connect(alice).combinationWithdraw(mintAmount)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(0);
        expect(await hope.balanceOf(vault.address)).to.be.equal(fee);

        const [wbtcAmountOfFee, ethAmountOfFee] = calculateReserveAmount(fee);

        expect(await wbtc.balanceOf(vault.address)).to.be.closeTo(
          wbtcAmountOfFee,
          parseUnits("0.00001", 8)
        );
        expect(await stETH.balanceOf(vault.address)).to.be.closeTo(
          ethAmountOfFee,
          parseUnits("0.00001", 18)
        );
        expect(await wbtc.balanceOf(alice.address)).to.be.closeTo(
          initialWBTCBalance.sub(wbtcAmountOfFee),
          parseUnits("0.00001", 8)
        );

        const [, ethAmountOfBurn] = calculateReserveAmount(mintAmount.sub(fee));
        expect(await stETH.balanceOf(alice.address)).to.be.equal(
          initialStETHBalance.add(ethAmountOfBurn)
        );

        expect(await weth.balanceOf(alice.address)).to.be.equal(
          initialWETHBalance.sub(ethAmount)
        );
      });
    });
    describe("Vault Claim", async () => {
      it("claim stETH", async () => {
        const { owner, alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);

        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await stETH.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, stETH.address)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(mintAmount);
        expect(await wbtc.balanceOf(vault.address)).to.be.equal(wbtcAmount);
        expect(await stETH.balanceOf(vault.address)).to.be.equal(ethAmount);
        expect(await wbtc.balanceOf(alice.address)).to.be.equal(
          initialWBTCBalance.sub(wbtcAmount)
        );
        expect(await stETH.balanceOf(alice.address)).to.be.equal(
          initialStETHBalance.sub(ethAmount)
        );

        await waitForTx(await vault.addVaultManager(owner.address));
        // Mock Lido rewards
        await waitForTx(
          await stETH.receiveRewards({ value: parseUnits("0.2", 18) })
        );
        // Vault StETH balance increase
        expect(await stETH.balanceOf(vault.address)).not.equal(ethAmount);

        const stETHBalance = await stETH.balanceOf(vault.address);
        const claimableStETH = stETHBalance.sub(ethAmount);
        expect(await vault.claimableStETH()).to.equal(claimableStETH);

        await waitForTx(await vault.claimStETH(owner.address));

        expect(await stETH.balanceOf(vault.address)).to.be.equal(ethAmount);
        expect(await stETH.balanceOf(owner.address)).to.be.equal(
          claimableStETH
        );
      });
      it("claim fee", async () => {
        const { owner, alice, hope, wbtc, weth, stETH, gateway, vault } =
          await loadFixture(deployGatewayFixture);

        const mintFeeRate = parseUnits("0.099999", 6);
        await waitForTx(await vault.updateMintFeeRate(mintFeeRate));

        const mintAmount = parseUnits("7503.15", 18);
        const fee = mintAmount.mul(mintFeeRate).div(parseUnits("1", 6));

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );
        await waitForTx(
          await weth.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, weth.address)
        );

        expect(await hope.balanceOf(alice.address)).to.be.equal(
          mintAmount.sub(fee)
        );
        expect(await hope.balanceOf(vault.address)).to.be.equal(fee);

        expect(await vault.claimableHOPE()).to.be.equal(fee);

        await waitForTx(await vault.addVaultManager(owner.address));
        await waitForTx(await vault.claimHOPE(owner.address));

        expect(await hope.balanceOf(vault.address)).to.be.equal(0);
        expect(await hope.balanceOf(owner.address)).to.be.equal(fee);
      });
    });
    describe("Pause", () => {
      it("deposit should revert when paused", async () => {
        const { alice, gateway, weth } = await loadFixture(
          deployGatewayFixture
        );
        await gateway.addEmergencyManager(alice.address);
        await gateway.connect(alice).pause();
        await expect(
          gateway.combinationDeposit(1, weth.address)
        ).to.revertedWith("Pausable: paused");
      });
      it("withdraw should revert when paused", async () => {
        const { alice, gateway, weth } = await loadFixture(
          deployGatewayFixture
        );
        await gateway.addEmergencyManager(alice.address);
        await gateway.connect(alice).pause();
        await expect(gateway.combinationWithdraw(1)).to.revertedWith(
          "Pausable: paused"
        );
      });
    });
    describe("rescue asset", () => {
      it("rescue ETH", async () => {
        const { owner, alice, bob, gateway, wbtc } = await loadFixture(
          deployGatewayFixture
        );

        await waitForTx(await gateway.addVaultManager(owner.address));

        const mintAmount = parseUnits("7503.15", 18);

        await waitForTx(
          await wbtc.connect(alice).approve(gateway.address, MAX_UINT_AMOUNT)
        );

        const [wbtcAmount, ethAmount] = calculateReserveAmount(mintAmount);

        const bobEthBalanceBefore = await bob.getBalance();

        await waitForTx(
          await gateway
            .connect(alice)
            .combinationDeposit(mintAmount, ETH_MOCK_ADDRESS, {
              value: ethAmount.mul(2),
            })
        );

        await gateway.rescueTokens(ETH_MOCK_ADDRESS, bob.address, ethAmount);
        expect(await bob.getBalance()).to.be.equal(
          bobEthBalanceBefore.add(ethAmount)
        );
      });
      it("rescue ERC20", async () => {
        const { owner, bob, gateway, usdt } = await loadFixture(
          deployGatewayFixture
        );

        await waitForTx(await gateway.addVaultManager(owner.address));

        const mintUSDTAmount = 1001;
        await usdt["mint(address,uint256)"](gateway.address, mintUSDTAmount);

        expect(await usdt.balanceOf(gateway.address)).to.be.equal(
          mintUSDTAmount
        );

        await gateway.rescueTokens(usdt.address, bob.address, mintUSDTAmount);

        expect(await usdt.balanceOf(gateway.address)).to.be.equal(0);
        expect(await usdt.balanceOf(bob.address)).to.be.equal(mintUSDTAmount);
      });
    });
  });
});
