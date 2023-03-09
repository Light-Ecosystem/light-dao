import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { PermitSigHelper } from "./PermitSigHelper";
import { upgrades } from "hardhat";

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("StakingHope", function () {
  const DAY = 86400;
  const YEAR = BigNumber.from(DAY * 365);

  async function deployOneYearLockFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const LT = await ethers.getContractFactory("LT");
    const VeLT = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const Minter = await ethers.getContractFactory("Minter");
    const StakingHOPE = await ethers.getContractFactory("StakingHOPE");
    const HOPE = await ethers.getContractFactory("HOPE");
    const RestrictedList = await ethers.getContractFactory("RestrictedList");
    const Admin = await ethers.getContractFactory("Admin");
    const TestLP = await ethers.getContractFactory("MockLP");


    const mockLpToken = await TestLP.deploy("stHope", "stHope", 18, 1000000); //Not using the actual InsureDAO contract

    const lt = await upgrades.deployProxy(LT, ["LT Dao Token", "LT"]);
    await lt.deployed();

    await time.increase(DAY);
    await lt.updateMiningParameters();

    const Permit2Contract = await ethers.getContractFactory("Permit2");
    const permit2 = await Permit2Contract.deploy();

    await lt.approve(permit2.address, ethers.constants.MaxUint256);

    const veLT = await VeLT.deploy(lt.address, permit2.address);
    await veLT.deployed();

    const gaugeController = await GaugeController.deploy(lt.address, veLT.address);
    await gaugeController.deployed();

    const minter = await Minter.deploy(lt.address, gaugeController.address);
    await minter.deployed();

    const restrictedList = await RestrictedList.deploy();

    const hopeToken = await upgrades.deployProxy(HOPE, [restrictedList.address]);
    await hopeToken.deployed();

    // approve owner, alice, bob
    await hopeToken.approve(permit2.address, ethers.utils.parseEther("1000"));
    await hopeToken.connect(alice).approve(permit2.address, ethers.utils.parseEther("1000"));
    await hopeToken.connect(bob).approve(permit2.address, ethers.utils.parseEther("1000"));


    const admin = await Admin.deploy(hopeToken.address);


    // const stakingHope = await upgrades.deployProxy(StakingHOPE, [hopeToken.address, minter.address, permit2.address]);
    const stakingHope = await StakingHOPE.deploy(hopeToken.address, minter.address, permit2.address);
    await stakingHope.deployed();

    return { lt, mockLpToken, permit2, veLT, gaugeController, hopeToken, minter, stakingHope, admin, owner, alice, bob };
  }

  describe("Set permit2 address", async () => {
    it("only owner can set", async () => {
      const { alice, stakingHope } = await loadFixture(deployOneYearLockFixture);
      await expect(stakingHope.connect(alice).setPermit2Address("0x000000000022D473030F116dDEE9F6B43aC78BA3")).to.be.revertedWith("Ownable: caller is not the owner");
    })
    it("can not set address zero", async () => {
      const { stakingHope } = await loadFixture(deployOneYearLockFixture);
      await expect(stakingHope.setPermit2Address(ethers.constants.AddressZero)).to.be.revertedWith("CE000");
    })
    it("set permit2 address success", async () => {
      const { stakingHope, permit2 } = await loadFixture(deployOneYearLockFixture);
      const newAddress = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
      await expect(stakingHope.setPermit2Address(newAddress)).to.be.emit(stakingHope, "SetPermit2Address")
        .withArgs(permit2.address, newAddress);
      expect(await stakingHope.permit2Address()).to.be.equal(newAddress);
    })
  })

  describe("test_checkpoint", async function () {
    it("test_user_checkpoint", async () => {
      const { stakingHope, alice } = await loadFixture(deployOneYearLockFixture);
      await stakingHope.connect(alice).userCheckpoint(alice.address);
    });

    it("test_user_checkpoint_new_period", async () => {
      const { stakingHope, alice } = await loadFixture(deployOneYearLockFixture);

      await stakingHope.connect(alice).userCheckpoint(alice.address);
      await ethers.provider.send("evm_increaseTime", [YEAR.mul("11").div("10").toNumber()]);
      await stakingHope.connect(alice).userCheckpoint(alice.address);
    });

    it("test_user_checkpoint_wrong_account", async () => {
      const { stakingHope, alice, bob } = await loadFixture(deployOneYearLockFixture);
      await expect(stakingHope.connect(alice).userCheckpoint(bob.address)).to.revertedWith("dev: unauthorized");
    });
  });

  describe("staking", function () {
    it("staking", async () => {
      const { hopeToken, permit2, admin, alice, owner, stakingHope } = await loadFixture(deployOneYearLockFixture);

      //const CREDIT = 100;
      //const MINT_AMOUNT = 10;
      let MINT_AMOUNT = ethers.utils.parseEther("1000");
      const DEADLINE = await time.latest() + 60 * 60;

      const effectiveBlock = await ethers.provider.getBlockNumber();
      const expirationBlock = effectiveBlock + 1000;
      await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);

      await admin.mint(alice.address, MINT_AMOUNT);

      expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
      // console.log("alice hope balance: %s", await hopeToken.balanceOf(alice.address));
      expect(await hopeToken.balanceOf(alice.address)).to.equal(MINT_AMOUNT);

      let amount = BigNumber.from(100);

      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);

      // stakingHope.on("Deposit", (sender:any, amount:any) => {
      //   console.log("Deposit Event: ", sender, amount);
      // });

      const sig = await PermitSigHelper.signature(alice, hopeToken.address, permit2.address, stakingHope.address, amount, NONCE, DEADLINE);
      //console.log("stakingHope: %s", stakingHope.address);
      //console.log("alice: %s", alice);
      await expect(stakingHope.connect(alice).staking(amount, NONCE, DEADLINE, sig)).emit(stakingHope, "Staking").withArgs(alice.address, amount);
      expect(await stakingHope.balanceOf(alice.address)).to.equal(amount);
      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(amount);
      expect(await stakingHope.lpTotalSupply()).to.equal(amount);

      //await new Promise(res => setTimeout(() => res(null), 5000));
    });


    it("should fail if amount is 0", async function () {
      const { hopeToken, permit2, admin, alice, stakingHope } = await loadFixture(deployOneYearLockFixture);

      //const CREDIT = 100;
      //const MINT_AMOUNT = 10;
      let MINT_AMOUNT = ethers.utils.parseEther("1000");
      const DEADLINE = await time.latest() + 60 * 60;

      const effectiveBlock = await ethers.provider.getBlockNumber();
      const expirationBlock = effectiveBlock + 1000;
      await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);

      await admin.mint(alice.address, MINT_AMOUNT);

      expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
      expect(await hopeToken.balanceOf(alice.address)).to.equal(MINT_AMOUNT);

      let amount = BigNumber.from(0);
      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);

      const sig = await PermitSigHelper.signature(alice, hopeToken.address, permit2.address, stakingHope.address, amount, NONCE, DEADLINE);

      await expect(stakingHope.connect(alice).staking(amount, NONCE, DEADLINE, sig)).to.be.revertedWith("INVALID_ZERO_AMOUNT");
    });

    it("Should fail if sender doesn’t have enough tokens", async () => {
      const { hopeToken, permit2, admin, alice, owner, stakingHope } = await loadFixture(deployOneYearLockFixture);

      //const CREDIT = 100;
      //const MINT_AMOUNT = 10;
      let MINT_AMOUNT = ethers.utils.parseEther("1000");
      const DEADLINE = await time.latest() + 60 * 60;

      const effectiveBlock = await ethers.provider.getBlockNumber();
      const expirationBlock = effectiveBlock + 1000;
      await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);

      await admin.mint(alice.address, MINT_AMOUNT);

      expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
      expect(await hopeToken.balanceOf(alice.address)).to.equal(MINT_AMOUNT);

      let amount = MINT_AMOUNT + 1;
      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);

      const sig = await PermitSigHelper.signature(alice, hopeToken.address, permit2.address, stakingHope.address, amount, NONCE, DEADLINE);
      await expect(stakingHope.connect(alice).staking(amount, NONCE, DEADLINE, sig)).to.be.revertedWith("INVALID_AMOUNT");
    });

  });

  describe("unstaking", function () {
    it("should unstaking", async function () {
      const { hopeToken, permit2, admin, alice, owner, stakingHope } = await loadFixture(deployOneYearLockFixture);

      let MINT_AMOUNT = ethers.utils.parseEther("1");
      const DEADLINE = await time.latest() + 60 * 60;

      const effectiveBlock = await ethers.provider.getBlockNumber();
      const expirationBlock = effectiveBlock + 1000;
      await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);

      await admin.mint(alice.address, MINT_AMOUNT);

      expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
      //console.log("alice hope balance: %s", await hopeToken.balanceOf(alice.address));
      expect(await hopeToken.balanceOf(alice.address)).to.equal(MINT_AMOUNT);

      let amount = BigNumber.from(100);

      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);

      // staking
      const sig = await PermitSigHelper.signature(alice, hopeToken.address, permit2.address, stakingHope.address, amount, NONCE, DEADLINE);
      expect(await stakingHope.connect(alice).staking(amount, NONCE, DEADLINE, sig)).emit(stakingHope, "Deposit").withArgs(alice.address, amount);
      expect(await stakingHope.balanceOf(alice.address)).to.equal(amount);

      expect(await stakingHope.balanceOf(alice.address)).to.equal(amount);
      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(amount);
      expect(await stakingHope.lpTotalSupply()).to.equal(amount);

      // unstaking
      let unStakingAmount = BigNumber.from(40);
      await stakingHope.connect(alice).unstaking(unStakingAmount);
      expect(await stakingHope.balanceOf(alice.address)).to.equal(amount);
      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(amount.sub(unStakingAmount));
      expect(await stakingHope.lpTotalSupply()).to.equal(amount.sub(unStakingAmount));

      expect(await stakingHope.unstakedBalanceOf(alice.address)).to.equal(BigNumber.from(0));
      expect((await stakingHope.unstakingMap(alice.address)).notRedeemAmount).to.equal(unStakingAmount);
      expect(await stakingHope.totalNotRedeemAmount()).to.equal(unStakingAmount);

      // increase 29 days
      await time.increase(86400 * 29);
      expect(await stakingHope.unstakedBalanceOf(alice.address)).to.equal(BigNumber.from(unStakingAmount));

      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(amount.sub(unStakingAmount));
      expect(await stakingHope.lpTotalSupply()).to.equal(amount.sub(unStakingAmount));

    });

  });

  describe("redeemAll", function () {

    it("test redeemAll ", async function () {
      const { hopeToken, permit2, admin, alice, owner, stakingHope } = await loadFixture(deployOneYearLockFixture);

      let MINT_AMOUNT = ethers.utils.parseEther("1");
      const DEADLINE = await time.latest() + 60 * 60;

      const effectiveBlock = await ethers.provider.getBlockNumber();
      const expirationBlock = effectiveBlock + 1000;
      await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);

      await admin.mint(alice.address, MINT_AMOUNT);

      expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
      //console.log("alice hope balance: %s", await hopeToken.balanceOf(alice.address));
      expect(await hopeToken.balanceOf(alice.address)).to.equal(MINT_AMOUNT);

      let stakingAmount = BigNumber.from(100);

      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);

      // staking
      const sig = await PermitSigHelper.signature(alice, hopeToken.address, permit2.address, stakingHope.address, stakingAmount, NONCE, DEADLINE);
      expect(await stakingHope.connect(alice).staking(stakingAmount, NONCE, DEADLINE, sig)).emit(stakingHope, "Deposit").withArgs(alice.address, stakingAmount);
      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);

      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);
      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(stakingAmount);
      expect(await stakingHope.lpTotalSupply()).to.equal(stakingAmount);

      // unstaking
      let unStakingAmount = BigNumber.from(40);
      await stakingHope.connect(alice).unstaking(unStakingAmount);

      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);
      expect(await stakingHope.totalSupply()).to.equal(stakingAmount);
      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(stakingAmount.sub(unStakingAmount));
      expect(await stakingHope.lpTotalSupply()).to.equal(stakingAmount.sub(unStakingAmount));

      // redeemAmount should be zero
      expect(await stakingHope.unstakedBalanceOf(alice.address)).to.equal(ethers.constants.Zero);
      // test notRedeemAmount
      expect((await stakingHope.unstakingMap(alice.address)).notRedeemAmount).to.equal(unStakingAmount);
      // test totalNotRedeemAmount
      expect(await stakingHope.totalNotRedeemAmount()).to.equal(unStakingAmount);

      // expect revert with "No redeemable amount"
      await expect(stakingHope.redeemAll()).to.revertedWith("No redeemable amount");


      // The unstaking process takes 28 days to complete.
      // During this period, the unstaked $HOPE cannot be traded, and no staking rewards are accrued.
      // increase 29 days
      await time.increase(86400 * 29);

      // stakingAmount - unStakingAmount
      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(stakingAmount.sub(unStakingAmount));
      let redeemAmount = await stakingHope.unstakedBalanceOf(alice.address);
      // redeemAmount == unStakingAmount
      expect(redeemAmount).to.equal(unStakingAmount);
      // stHope == stakingAmount
      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);
      expect(await stakingHope.totalSupply()).to.equal(stakingAmount);

      // redeemAll (redeem all redeemable amount to user wallet)
      await stakingHope.connect(alice).redeemAll();

      // stHope = stakingAmount - unStakingAmount
      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount.sub(unStakingAmount));
      expect(await stakingHope.totalSupply()).to.equal(stakingAmount.sub(unStakingAmount));

      // no change
      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(stakingAmount.sub(unStakingAmount));
      expect(await stakingHope.lpTotalSupply()).to.equal(stakingAmount.sub(unStakingAmount));

    });

    it("staking amount and unstaking mnay time  then use redeemByMaxIndex", async function () {
      const { hopeToken, permit2, admin, alice, owner, stakingHope, gaugeController } = await loadFixture(deployOneYearLockFixture);

      let MINT_AMOUNT = ethers.utils.parseEther("100");
      const DEADLINE = await time.latest() + 60 * 60;


      let typeId = await gaugeController.nGaugeTypes();
      let weight = ethers.utils.parseEther("1");
      let gaugeWeight = ethers.utils.parseEther("1");
      await gaugeController.addType("stLiquidity", BigNumber.from(0));
      await gaugeController.changeTypeWeight(typeId, weight);
      await gaugeController.addGauge(stakingHope.address, typeId, gaugeWeight);


      const effectiveBlock = await ethers.provider.getBlockNumber();
      const expirationBlock = effectiveBlock + 1000;
      await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);

      // mint hope
      await admin.mint(alice.address, MINT_AMOUNT);

      expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
      expect(await hopeToken.balanceOf(alice.address)).to.equal(MINT_AMOUNT);

      let stakingAmount = BigNumber.from(10000);

      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);

      // staking
      const sig = await PermitSigHelper.signature(alice, hopeToken.address, permit2.address, stakingHope.address, stakingAmount, NONCE, DEADLINE);
      expect(await stakingHope.connect(alice).staking(stakingAmount, NONCE, DEADLINE, sig)).emit(stakingHope, "Deposit").withArgs(alice.address, stakingAmount);

      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);

      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);
      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(stakingAmount);
      expect(await stakingHope.lpTotalSupply()).to.equal(stakingAmount);

      // integrateFraction > 0
      await time.increase(86400 * 30);
      await stakingHope.connect(alice).userCheckpoint(alice.address);
      const integrateFraction = await stakingHope.integrateFraction(alice.address);
      expect(integrateFraction).greaterThan(BigNumber.from(0));

      let unStakingAmountTotal = BigNumber.from(0);
      // unstaking 50 times
      for (let i = 0; i < 50; i++) {
        let unStakingAmount = BigNumber.from(1);
        await stakingHope.connect(alice).unstaking(unStakingAmount);
        unStakingAmountTotal = unStakingAmountTotal.add(unStakingAmount);

        expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);
        expect(await stakingHope.totalSupply()).to.equal(stakingAmount);
        expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(stakingAmount.sub(unStakingAmountTotal));
        expect(await stakingHope.lpTotalSupply()).to.equal(stakingAmount.sub(unStakingAmountTotal));

        expect(await stakingHope.unstakedBalanceOf(alice.address)).to.equal(BigNumber.from(0));

        expect((await stakingHope.unstakingMap(alice.address)).notRedeemAmount).to.equal(unStakingAmountTotal);
        expect(await stakingHope.totalNotRedeemAmount()).to.equal(unStakingAmountTotal);
      }

      // unstakingAmount = unStakingAmountTotal
      expect(await stakingHope.unstakingBalanceOf(alice.address)).to.equal(unStakingAmountTotal);
      expect(await stakingHope.unstakingTotal()).to.equal(unStakingAmountTotal);

      // expect revert with "No redeemable amount"
      await expect(stakingHope.redeemByMaxIndex(10)).to.revertedWith("No redeemable amount");

      // increase 29 days
      await time.increase(86400 * 29);

      // await stakingHope.connect(alice).userCheckpoint(alice.address);
      // expect(await stakingHope.integrateFraction(alice.address)).to.equal(integrateFraction)

      // unstakingAmount = 0
      expect(await stakingHope.unstakingBalanceOf(alice.address)).to.equal(BigNumber.from(0));
      expect(await stakingHope.unstakingTotal()).to.equal(BigNumber.from(0));


      let redeemAmount = await stakingHope.unstakedBalanceOf(alice.address);
      let originAmount = redeemAmount;
      expect(redeemAmount).to.equal(unStakingAmountTotal);

      for (let i = 0; i < 5; i++) {
        await stakingHope.connect(alice).redeemByMaxIndex(10);
        redeemAmount = redeemAmount.sub(BigNumber.from(10));
        expect(await stakingHope.unstakedBalanceOf(alice.address)).to.equal(redeemAmount);
        expect(await stakingHope.unstakedTotal()).to.equal(redeemAmount);
      }

      stakingHope.connect(alice).redeemByMaxIndex(10);
      expect(await stakingHope.unstakedBalanceOf(alice.address)).to.equal(ethers.constants.Zero);
      expect(await stakingHope.unstakedTotal()).to.equal(ethers.constants.Zero);


      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(stakingAmount.sub(originAmount));

      // stHope to zero
      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount.sub(originAmount));
      expect(await stakingHope.totalSupply()).to.equal(stakingAmount.sub(originAmount));

      // no change
      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(stakingAmount.sub(unStakingAmountTotal));
      expect(await stakingHope.lpTotalSupply()).to.equal(stakingAmount.sub(unStakingAmountTotal));

    });

  });

  describe("transfer ", function () {
    it("test transfer ", async function () {
      const { hopeToken, permit2, admin, alice, bob, stakingHope } = await loadFixture(deployOneYearLockFixture);

      let MINT_AMOUNT = ethers.utils.parseEther("100");
      const DEADLINE = await time.latest() + 60 * 60;

      const effectiveBlock = await ethers.provider.getBlockNumber();
      const expirationBlock = effectiveBlock + 1000;
      await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);

      // mint hope
      await admin.mint(alice.address, MINT_AMOUNT);

      expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
      expect(await hopeToken.balanceOf(alice.address)).to.equal(MINT_AMOUNT);

      let stakingAmount = BigNumber.from(10000);

      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);

      // staking
      const sig = await PermitSigHelper.signature(alice, hopeToken.address, permit2.address, stakingHope.address, stakingAmount, NONCE, DEADLINE);
      expect(await stakingHope.connect(alice).staking(stakingAmount, NONCE, DEADLINE, sig)).emit(stakingHope, "Deposit").withArgs(alice.address, stakingAmount);
      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);

      const originAliceBalance = await stakingHope.balanceOf(alice.address);
      const originBobBalance = await stakingHope.balanceOf(bob.address);

      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);

      const originLpBalance = await stakingHope.lpBalanceOf(alice.address);
      expect(originLpBalance).to.equal(stakingAmount);

      const originLpTotoalSupply = await stakingHope.lpTotalSupply();
      expect(originLpTotoalSupply).to.equal(stakingAmount);

      let transAmout = BigNumber.from(10);
      // transfer 10
      await stakingHope.connect(alice).transfer(bob.address, transAmout);
      expect(await stakingHope.balanceOf(alice.address)).to.equal(originAliceBalance.sub(transAmout));
      expect(await stakingHope.balanceOf(bob.address)).to.equal(originBobBalance.add(transAmout));

      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(originLpBalance.sub(transAmout));
      expect(await stakingHope.lpBalanceOf(bob.address)).to.equal(originBobBalance.add(transAmout));

      expect(await stakingHope.lpTotalSupply()).to.equal(originLpTotoalSupply);
    });


    it("test transferFrom ", async function () {
      const { hopeToken, permit2, admin, owner, alice, bob, stakingHope } = await loadFixture(deployOneYearLockFixture);

      let MINT_AMOUNT = ethers.utils.parseEther("100");
      const DEADLINE = await time.latest() + 60 * 60;

      const effectiveBlock = await ethers.provider.getBlockNumber();
      const expirationBlock = effectiveBlock + 1000;
      await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);

      // mint hope
      await admin.mint(alice.address, MINT_AMOUNT);

      expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
      expect(await hopeToken.balanceOf(alice.address)).to.equal(MINT_AMOUNT);

      let stakingAmount = BigNumber.from(10000);

      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);

      // staking
      const sig = await PermitSigHelper.signature(alice, hopeToken.address, permit2.address, stakingHope.address, stakingAmount, NONCE, DEADLINE);
      expect(await stakingHope.connect(alice).staking(stakingAmount, NONCE, DEADLINE, sig)).emit(stakingHope, "Deposit").withArgs(alice.address, stakingAmount);
      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);

      const originAliceBalance = await stakingHope.balanceOf(alice.address);
      const originBobBalance = await stakingHope.balanceOf(bob.address);

      expect(await stakingHope.balanceOf(alice.address)).to.equal(stakingAmount);

      const originLpBalance = await stakingHope.lpBalanceOf(alice.address);
      expect(originLpBalance).to.equal(stakingAmount);

      const originLpTotoalSupply = await stakingHope.lpTotalSupply();
      expect(originLpTotoalSupply).to.equal(stakingAmount);

      let transAmout = BigNumber.from(10);

      // approve
      await stakingHope.connect(alice).approve(owner.address, transAmout);
      // transferfrom
      await stakingHope.transferFrom(alice.address, bob.address, transAmout);

      expect(await stakingHope.balanceOf(alice.address)).to.equal(originAliceBalance.sub(transAmout));
      expect(await stakingHope.balanceOf(bob.address)).to.equal(originBobBalance.add(transAmout));

      expect(await stakingHope.lpBalanceOf(alice.address)).to.equal(originLpBalance.sub(transAmout));
      expect(await stakingHope.lpBalanceOf(bob.address)).to.equal(originBobBalance.add(transAmout));

      expect(await stakingHope.lpTotalSupply()).to.equal(originLpTotoalSupply);
    });

    it("shoule revert when transfer  amount  > lpBalanceOf() ", async function () {
      const { hopeToken, permit2, admin, alice, bob, stakingHope } = await loadFixture(deployOneYearLockFixture);

      let MINT_AMOUNT = ethers.utils.parseEther("100");
      const DEADLINE = await time.latest() + 60 * 60;

      const effectiveBlock = await ethers.provider.getBlockNumber();
      const expirationBlock = effectiveBlock + 1000;
      await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);

      // mint hope
      await admin.mint(alice.address, MINT_AMOUNT);

      expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
      expect(await hopeToken.balanceOf(alice.address)).to.equal(MINT_AMOUNT);

      let stakingAmount = BigNumber.from(10000);

      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);

      // staking
      const sig = await PermitSigHelper.signature(alice, hopeToken.address, permit2.address, stakingHope.address, stakingAmount, NONCE, DEADLINE);
      await stakingHope.connect(alice).staking(stakingAmount, NONCE, DEADLINE, sig);

      const originAliceBalance = await stakingHope.balanceOf(alice.address);
      const originBobBalance = await stakingHope.balanceOf(bob.address);

      // unstaking （stakingAmount / 2）
      await stakingHope.connect(alice).unstaking(stakingAmount / 2);

      // revert
      let transAmout = stakingAmount;
      await expect(stakingHope.transfer(bob.address, transAmout)).to.revertedWith("ERC20: transfer amount exceeds balance");

      // transfer
      transAmout = stakingAmount / 2;
      // console.log(await stakingHope.lpBalanceOf(alice.address))
      await stakingHope.connect(alice).transfer(bob.address, transAmout);

      expect(await stakingHope.balanceOf(alice.address)).to.equal(originAliceBalance.sub(transAmout));
      expect(await stakingHope.balanceOf(bob.address)).to.equal(originBobBalance.add(transAmout));
      expect(await stakingHope.lpBalanceOf(bob.address)).to.equal(originBobBalance.add(transAmout));

    });

  });
});
