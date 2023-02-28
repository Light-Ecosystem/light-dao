import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { network, upgrades } from "hardhat";
import * as timers from "timers";

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");


describe("GombocFactory", function () {

  const DAY = 86400;
  const WEEK = DAY * 7;

  async function deployOneYearLockFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MyERC20 = await ethers.getContractFactory("MockLP");
    const mytoken = await MyERC20.deploy("TokenA", "A", 18, 1000000);
    await mytoken.deployed();

    const MyERC20LT = await ethers.getContractFactory("LT");
    const VeLT = await ethers.getContractFactory("VotingEscrow");
    const GombocController = await ethers.getContractFactory("GombocController");
    const PoolGomboc = await ethers.getContractFactory("PoolGomboc");
    const TestLP = await ethers.getContractFactory("MockLP");
    const Minter = await ethers.getContractFactory("Minter");
    const GombocFactory = await ethers.getContractFactory("GombocFactory");

    // init 1000
    const mockLpToken = await TestLP.deploy("USED/DAI Pair", "uni pair", 18, ethers.utils.parseEther("604800")); //Not using the actual InsureDAO contract

    const lt = await upgrades.deployProxy(MyERC20LT, ["LT Dao Token", "LT"]);
    await lt.deployed();

    const Permit2Contract = await ethers.getContractFactory("Permit2");
    const permit2 = await Permit2Contract.deploy();

    const veLT = await VeLT.deploy(lt.address, permit2.address);
    await veLT.deployed();

    const gombocController = await GombocController.deploy(lt.address, veLT.address);
    await gombocController.deployed();

    const minter = await Minter.deploy(lt.address, gombocController.address);
    await minter.deployed();

    // deploy pool gomboc
    const poolGombocImplementation = await PoolGomboc.deploy();
    await poolGombocImplementation.deployed();
    poolGombocImplementation.initialize(mockLpToken, minter, permit2, "0");

    // deploy gomboc factory
    const gombocFactory = await GombocFactory.deploy(poolGombocImplementation.address, minter.address, permit2.address);
    await gombocFactory.deployed();

    // deploy pool gomboc by Factory
    await gombocFactory.createPool(mockLpToken.address);
    // get pool address
    const poolGombocAddress = await gombocFactory.getPool(mockLpToken.address);
    // load pool gomboc
    const poolGomboc = PoolGomboc.attach(poolGombocAddress);

    return { mockLpToken, gombocFactory, poolGomboc, poolGombocImplementation, minter, permit2, mytoken, owner, alice, bob };

  }

  describe("Set permit2 address", async () => {
    it("only owner can set", async () => {
      const { alice, gombocFactory } = await loadFixture(deployOneYearLockFixture);
      await expect(gombocFactory.connect(alice).setPermit2Address("0x000000000022D473030F116dDEE9F6B43aC78BA3")).to.be.revertedWith("Ownable: caller is not the owner");
    })
    it("can not set address zero", async () => {
      const { gombocFactory } = await loadFixture(deployOneYearLockFixture);
      await expect(gombocFactory.setPermit2Address(ethers.constants.AddressZero)).to.be.revertedWith("CE000");
    })
    it("set permit2 address success", async () => {
      const { gombocFactory, permit2 } = await loadFixture(deployOneYearLockFixture);
      const newAddress = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
      await expect(gombocFactory.setPermit2Address(newAddress)).to.be.emit(gombocFactory, "SetPermit2Address")
        .withArgs(permit2.address, newAddress);
      expect(await gombocFactory.permit2()).to.be.equal(newAddress);
    })
  })

  describe("test gomboc factory", function () {

    it("test onwer", async function () {
      const { gombocFactory, poolGomboc, poolGombocImplementation, owner } = await loadFixture(deployOneYearLockFixture);
      expect(await gombocFactory.owner()).to.equal(owner.address);
      expect(await poolGomboc.owner()).to.equal(owner.address);
      expect(await poolGombocImplementation.owner()).to.equal(owner.address);
    });


    it("should revert right error when init twice", async function () {
      const { poolGombocImplementation, poolGomboc, mockLpToken, minter, permit2, bob } = await loadFixture(deployOneYearLockFixture);

      await expect(poolGomboc.initialize(mockLpToken.address, minter.address, permit2.address, bob.address)).to.revertedWith("PoolGomboc: FORBIDDEN");
      await expect(poolGombocImplementation.initialize(mockLpToken.address, minter.address, permit2.address, bob.address)).to.revertedWith("PoolGomboc: FORBIDDEN");
    });

    it("test  gomboc reward others tokens", async function () {
      const { poolGomboc, mytoken, owner, mockLpToken } = await loadFixture(deployOneYearLockFixture);

      await poolGomboc.addReward(mytoken.address, owner.address);
      const rewardAmout = await mytoken.totalSupply();
      await mytoken.approve(poolGomboc.address, rewardAmout);
      await poolGomboc.depositRewardToken(mytoken.address, rewardAmout);
      expect(await poolGomboc.rewardCount()).to.equal(BigNumber.from("1"));
    });

  });


});