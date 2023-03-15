import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { upgrades } from "hardhat";

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");


describe("GaugeFactory", function() {

  const DAY = 86400;
  const WEEK = DAY * 7;

  async function deployOneYearLockFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MyERC20 = await ethers.getContractFactory("MockLP");
    const mytoken = await MyERC20.deploy("TokenA", "A", 18, 1000000);
    await mytoken.deployed();

    const MyERC20LT = await ethers.getContractFactory("LT");
    const VeLT = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const PoolGauge = await ethers.getContractFactory("PoolGauge");
    const TestLP = await ethers.getContractFactory("MockLP");
    const Minter = await ethers.getContractFactory("Minter");
    const GaugeFactory = await ethers.getContractFactory("GaugeFactory");

    // init 1000
    const mockLpToken = await TestLP.deploy("USED/DAI Pair", "uni pair", 18, ethers.utils.parseEther("604800"));

    const lt = await upgrades.deployProxy(MyERC20LT, ["LT Dao Token", "LT"]);
    await lt.deployed();

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
    poolGaugeImplementation.initialize(mockLpToken, minter, permit2, "0");

    // deploy gauge factory
    const gaugeFactory = await GaugeFactory.deploy(poolGaugeImplementation.address, minter.address, permit2.address);
    await gaugeFactory.deployed();

    // deploy pool gauge by Factory
    await gaugeFactory.createPool(mockLpToken.address);
    // get pool address
    const poolGaugeAddress = await gaugeFactory.getPool(mockLpToken.address);
    // load pool gauge
    const poolGauge = PoolGauge.attach(poolGaugeAddress);

    return {
      mockLpToken,
      gaugeFactory,
      poolGauge,
      poolGaugeImplementation,
      minter,
      permit2,
      mytoken,
      owner,
      alice,
      bob,
      TestLP,
      PoolGauge
    };

  }

  describe("Set permit2 address", async () => {
    it("only owner can set", async () => {
      const { alice, gaugeFactory } = await loadFixture(deployOneYearLockFixture);
      await expect(gaugeFactory.connect(alice).setPermit2Address("0x000000000022D473030F116dDEE9F6B43aC78BA3")).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("can not set address zero", async () => {
      const { gaugeFactory } = await loadFixture(deployOneYearLockFixture);
      await expect(gaugeFactory.setPermit2Address(ethers.constants.AddressZero)).to.be.revertedWith("CE000");
    });
    it("set permit2 address success", async () => {
      const { gaugeFactory, permit2 } = await loadFixture(deployOneYearLockFixture);
      const newAddress = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
      await expect(gaugeFactory.setPermit2Address(newAddress)).to.be.emit(gaugeFactory, "SetPermit2Address")
        .withArgs(permit2.address, newAddress);
      expect(await gaugeFactory.permit2()).to.be.equal(newAddress);
    });
  });

  describe("test gauge factory", function() {

    it("test onwer", async function() {
      const { gaugeFactory, poolGauge, poolGaugeImplementation, owner } = await loadFixture(deployOneYearLockFixture);
      expect(await gaugeFactory.owner()).to.equal(owner.address);
      expect(await poolGauge.owner()).to.equal(owner.address);
      expect(await poolGaugeImplementation.owner()).to.equal(owner.address);
    });


    it("should revert right error when init twice", async function() {
      const { poolGaugeImplementation, poolGauge, mockLpToken, minter, permit2, bob } = await loadFixture(deployOneYearLockFixture);

      await expect(poolGauge.initialize(mockLpToken.address, minter.address, permit2.address, bob.address)).to.revertedWith("PoolGauge: FORBIDDEN");
      await expect(poolGaugeImplementation.initialize(mockLpToken.address, minter.address, permit2.address, bob.address)).to.revertedWith("PoolGauge: FORBIDDEN");
    });

    it("test  gauge reward others tokens", async function() {
      const { poolGauge, mytoken, owner, mockLpToken } = await loadFixture(deployOneYearLockFixture);

      await poolGauge.addReward(mytoken.address, owner.address);
      const rewardAmout = await mytoken.totalSupply();
      await mytoken.approve(poolGauge.address, rewardAmout);
      await poolGauge.depositRewardToken(mytoken.address, rewardAmout);
      expect(await poolGauge.rewardCount()).to.equal(BigNumber.from("1"));
    });

  });

  describe("Test owner", function() {
    it("test set gauge owner is right", async function() {
      const { gaugeFactory, alice, TestLP, PoolGauge } = await loadFixture(deployOneYearLockFixture);
      await gaugeFactory.setGaugeOwner(alice.address);

      expect(await gaugeFactory.gaugeOwner()).to.equal(alice.address);
      const mockLpToken = await TestLP.deploy("USED/DAI Pair", "uni pair", 18, ethers.utils.parseEther("604800"));
      // deploy pool gauge by Factory
      await gaugeFactory.createPool(mockLpToken.address);
      // get pool address
      const poolGaugeAddress = await gaugeFactory.getPool(mockLpToken.address);
      // load pool gauge
      const poolGauge = PoolGauge.attach(poolGaugeAddress);
      expect(await poolGauge.owner()).to.equal(alice.address);
    });


    it("test owner or operator  can create gauge pool", async function() {
      const { gaugeFactory, TestLP, alice } = await loadFixture(deployOneYearLockFixture);

      await gaugeFactory.setOperator(alice.address);
      expect(await gaugeFactory.operator()).to.equal(alice.address);

      // test owner create gauge pool
      const mockLpToken = await TestLP.deploy("USED/DAI Pair", "uni pair", 18, ethers.utils.parseEther("604800"));
      await gaugeFactory.createPool(mockLpToken.address);
      // test operator create gauge pool
      const mockLpToken2 = await TestLP.deploy("USED/DAI Pair", "uni pair", 18, ethers.utils.parseEther("604800"));
      await gaugeFactory.connect(alice).createPool(mockLpToken2.address);
    });

    it("should revert error when create twice", async function() {
      const { gaugeFactory, TestLP, alice } = await loadFixture(deployOneYearLockFixture);

      await gaugeFactory.setOperator(alice.address);
      expect(await gaugeFactory.operator()).to.equal(alice.address);

      // test owner create gauge pool
      const mockLpToken = await TestLP.deploy("USED/DAI Pair", "uni pair", 18, ethers.utils.parseEther("604800"));
      // first createPool
      await gaugeFactory.createPool(mockLpToken.address);
      // second createPool
      await expect(gaugeFactory.createPool(mockLpToken.address)).to.revertedWith("ERC1167: create2 failed")
    });
  });


});