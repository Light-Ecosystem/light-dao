import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { network, upgrades } from "hardhat";
import { PermitSigHelper } from "./PermitSigHelper";

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");


describe("PoolGauge", function() {
  const DAY = 86400;
  const WEEK = DAY * 7;

  async function deployOneYearLockFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MyERC20LT = await ethers.getContractFactory("LT");
    const VeLT = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const PoolGauge = await ethers.getContractFactory("PoolGaugeV2");
    const TestLP = await ethers.getContractFactory("MockLP");
    const Minter = await ethers.getContractFactory("Minter");
    const GaugeFactory = await ethers.getContractFactory("GaugeFactory");

    // init 1000
    const mockLpToken = await TestLP.deploy("USED/DAI Pair", "uni pair", 18, 1000000);


    const lt = await upgrades.deployProxy(MyERC20LT, ["LT Dao Token", "LT"]);
    await lt.deployed();
    await time.increase(2 * DAY);
    await lt.updateMiningParameters();

    const Permit2Contract = await ethers.getContractFactory("Permit2");
    const permit2 = await Permit2Contract.deploy();

    const veLT = await VeLT.deploy(lt.address, permit2.address);
    await veLT.deployed();

    const gaugeController = await GaugeController.deploy(lt.address, veLT.address);
    await gaugeController.deployed();

    const minter = await Minter.deploy(lt.address, gaugeController.address);
    await minter.deployed();

    // deploy pool gauge
    const poolGaugeImplementation = await PoolGauge.deploy();
    await poolGaugeImplementation.deployed();

    // deploy gauge factory
    const gaugeFactory = await GaugeFactory.deploy(poolGaugeImplementation.address, minter.address, permit2.address);
    await gaugeFactory.deployed();

    // deploy pool gauge by Factory
    await gaugeFactory.createPool(mockLpToken.address);
    // get pool address
    const poolGaugeAddress = await gaugeFactory.getPool(mockLpToken.address);
    // load pool gauge
    const poolGauge = PoolGauge.attach(poolGaugeAddress);
    const periodTime = await time.latest();
    return { lt, permit2, veLT, gaugeController, mockLpToken, minter, poolGauge, owner, alice, bob, periodTime };
  }


  describe("test pool gauge", function() {

    it("deposit test", async function() {
      const { lt, mockLpToken, gaugeController, poolGauge, owner, bob, periodTime, permit2 } = await loadFixture(deployOneYearLockFixture);

      // Add a week
      await time.increase(WEEK);

      // depost 1
      let despostAmount = BigNumber.from(10);
      await mockLpToken.approve(poolGauge.address, despostAmount);
      // deposit
      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);
      let DEADLINE = await time.latest() + 60 * 60;
      let sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await time.increase(2000);
      await poolGauge.claimableTokens(owner.address);
      await poolGauge["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));

      // depost 2
      await mockLpToken.approve(poolGauge.address, despostAmount);
      // deposit
      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      DEADLINE = await time.latest() + 60 * 60;
      sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await time.increase(2000);
      await poolGauge.claimableTokens(owner.address);
      await poolGauge["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));

      // depost 3
      await mockLpToken.approve(poolGauge.address, despostAmount);
      // deposit
      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      DEADLINE = await time.latest() + 60 * 60;
      sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await time.increase(2000);
      await poolGauge.claimableTokens(owner.address);
      await poolGauge["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));

      // depost 4
      await mockLpToken.approve(poolGauge.address, despostAmount);
      // deposit
      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      DEADLINE = await time.latest() + 60 * 60;
      sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await time.increase(2000);
      await poolGauge.claimableTokens(owner.address);
      await poolGauge["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));

      // Add a week
      await time.increase(WEEK);

      // depost 1
      await mockLpToken.approve(poolGauge.address, despostAmount);
      // deposit
      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      DEADLINE = await time.latest() + 60 * 60;
      sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await time.increase(2000);
      await poolGauge.claimableTokens(owner.address);
      await poolGauge["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));


      // depost 2
      await mockLpToken.approve(poolGauge.address, despostAmount);
      // deposit
      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      DEADLINE = await time.latest() + 60 * 60;
      sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await time.increase(2000);
      await poolGauge.claimableTokens(owner.address);
      await poolGauge["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));

      // depost 3
      await mockLpToken.approve(poolGauge.address, despostAmount);
      // deposit
      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      DEADLINE = await time.latest() + 60 * 60;
      sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await time.increase(2000);
      await poolGauge.claimableTokens(owner.address);
      await poolGauge["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));

      // depost 4
      await mockLpToken.approve(poolGauge.address, despostAmount);
      // deposit
      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      DEADLINE = await time.latest() + 60 * 60;
      sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await time.increase(2000);
      await poolGauge.claimableTokens(owner.address);
      await poolGauge["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));
    });
  });


});