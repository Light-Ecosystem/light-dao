import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { upgrades } from "hardhat";

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GrantsGauge", function () {
  const DAY = 86400;
  const WEEK = DAY * 7;
  const ZERO_ADDRESS = ethers.constants.AddressZero;
  const ONE_ETHER = ethers.utils.parseEther("1");

  async function deployFixture() {
    const [owner, alice, receiver] = await ethers.getSigners();

    const MyERC20LT = await ethers.getContractFactory("LT");
    const VeLT = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const PoolGauge = await ethers.getContractFactory("PoolGauge");
    const GrantsGauge = await ethers.getContractFactory("GrantsGauge");
    const TestLP = await ethers.getContractFactory("MockLP");
    const Minter = await ethers.getContractFactory("Minter");
    const GaugeFactory = await ethers.getContractFactory("GaugeFactory");

    // init 1000000
    const mockLpToken = await TestLP.deploy(
      "USED/DAI Pair",
      "uni pair",
      18,
      1000000
    );

    const lt = await upgrades.deployProxy(MyERC20LT, ["LT Dao Token", "LT"]);
    await lt.deployed();
    await time.increase(2 * DAY);
    await lt.updateMiningParameters();

    const Permit2Contract = await ethers.getContractFactory("Permit2");
    const permit2 = await Permit2Contract.deploy();

    const veLT = await VeLT.deploy(lt.address, permit2.address);
    await veLT.deployed();

    const gaugeController = await GaugeController.deploy(
      lt.address,
      veLT.address
    );
    await gaugeController.deployed();

    const minter = await Minter.deploy(lt.address, gaugeController.address);
    await minter.deployed();
    await lt.setMinter(minter.address);

    // deploy pool gauge
    const poolGaugeImplementation = await PoolGauge.deploy();
    await poolGaugeImplementation.deployed();

    // deploy gauge factory
    const gaugeFactory = await GaugeFactory.deploy(
      poolGaugeImplementation.address,
      minter.address,
      permit2.address
    );
    await gaugeFactory.deployed();

    // deploy pool gauge by Factory
    await gaugeFactory.createPool(mockLpToken.address);
    // get pool address
    const poolGaugeAddress = await gaugeFactory.getPool(mockLpToken.address);
    // load pool gauge
    const poolGauge = PoolGauge.attach(poolGaugeAddress);
    // const periodTime = await time.latest();

    // deploy GrantsGauge
    const grantsGauge = await GrantsGauge.deploy(
      lt.address,
      gaugeController.address,
      minter.address,
      receiver.address
    );
    await grantsGauge.deployed();

    // add gaugeType and add gauges
    let typeWeight = ONE_ETHER;
    let gaugeWeight = ONE_ETHER;
    await gaugeController.addType("Liquidity", typeWeight);
    await gaugeController.addType("GrantsGauge", typeWeight);
    await gaugeController.addGauge(poolGauge.address, 0, gaugeWeight);
    await gaugeController.addGauge(grantsGauge.address, 1, gaugeWeight);

    return { grantsGauge, lt, veLT, gaugeController, owner, alice, receiver };
  }

  describe("setKilled", async () => {
    it("only owner can setKilled", async () => {
      const { grantsGauge, alice } = await loadFixture(deployFixture);
      await expect(
        grantsGauge.connect(alice).setKilled(true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("when set killed, the integrateFraction should be 0", async () => {
      const { grantsGauge } = await loadFixture(deployFixture);

      await time.increase(2 * WEEK);
      await grantsGauge.userCheckpoint(ZERO_ADDRESS);
      let totalEmissions = await grantsGauge.totalEmissions();
      expect(totalEmissions).to.be.gt(ethers.constants.Zero);

      // setKilled
      await grantsGauge.setKilled(true);
      await time.increase(2 * WEEK);
      await grantsGauge.userCheckpoint(ZERO_ADDRESS);
      let newTotalEmissions = await grantsGauge.totalEmissions();
      expect(newTotalEmissions).to.be.equal(totalEmissions);
    });
  });

  describe("userCheckpoint", async () => {
    it("after checkpoint, the totalEmissions should be right", async () => {
      const { grantsGauge, lt, gaugeController } = await loadFixture(
        deployFixture
      );

      await time.increase(10 * WEEK);
      await grantsGauge.userCheckpoint(ZERO_ADDRESS);
      let totalEmissions = await grantsGauge.totalEmissions();

      let ltEmissionRate = await lt.rate();
      let relativeWeight = await gaugeController.gaugeRelativeWeight(
        grantsGauge.address,
        await time.latest()
      );
      // the first week have no weight, so duration is 9 week
      let emisssionsForGrantsGauge = ltEmissionRate
        .mul(9 * WEEK)
        .mul(relativeWeight)
        .div(ONE_ETHER); // the ralativeWeight is 50%
      expect(totalEmissions).to.be.equal(emisssionsForGrantsGauge);
    });

    it("after the vote, the totalEmissions should be right", async () => {
      const { grantsGauge, lt, veLT, gaugeController } = await loadFixture(
        deployFixture
      );
      // prepare veLT
      await lt.approve(veLT.address, ethers.constants.MaxUint256);
      let end = (await time.latest()) + 208 * WEEK;
      await veLT.createLock(ONE_ETHER.mul(10000000000), end, 0, 0, "0x");
      await gaugeController.voteForGaugeWeights(grantsGauge.address, 10000);

      await time.increase(WEEK);
      let relativeWeight = await gaugeController.gaugeRelativeWeight(
        grantsGauge.address,
        await time.latest()
      );

      await time.increase(WEEK);
      await grantsGauge.userCheckpoint(ZERO_ADDRESS);
      let totalEmissions = await grantsGauge.totalEmissions();

      let ltEmissionRate = await lt.rate();
      let emisssionsForGrantsGauge = ltEmissionRate
        .mul(WEEK)
        .mul(relativeWeight)
        .div(ONE_ETHER);
      expect(totalEmissions).to.be.equal(emisssionsForGrantsGauge);
    });
  });

  describe("integrateFraction", async () => {
    it("integrateFraction should be right", async () => {
      const { grantsGauge, alice } = await loadFixture(deployFixture);

      await time.increase(10 * WEEK);
      await grantsGauge.userCheckpoint(ZERO_ADDRESS);
      let totalEmissions = await grantsGauge.totalEmissions();

      let invOfSelf = await grantsGauge.integrateFraction(grantsGauge.address);
      let invOfAlice = await grantsGauge.integrateFraction(alice.address);
      expect(invOfSelf).to.be.equal(totalEmissions);
      expect(invOfAlice).to.be.equal(ethers.constants.Zero);
    });
  });

  describe("transmitEmissions", async () => {
    it("after transmitEmissions, the balance of receiver should be right", async () => {
      const { grantsGauge, receiver, lt } = await loadFixture(deployFixture);

      await time.increase(10 * WEEK);
      await grantsGauge.userCheckpoint(ZERO_ADDRESS);
      let totalEmissions = await grantsGauge.totalEmissions();

      await grantsGauge.transmitEmissions();
      let balance = await lt.balanceOf(receiver.address);
      expect(balance).to.be.equal(totalEmissions);
    });
  });

  describe("updateReceiver", async () => {
    it("only owner can updateReceiver", async () => {
      const { grantsGauge, alice } = await loadFixture(deployFixture);
      await expect(
        grantsGauge.connect(alice).updateReceiver(alice.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("after updateReceiver, the balance of new receiver should be right", async () => {
      const { grantsGauge, alice, lt } = await loadFixture(deployFixture);
      await grantsGauge.updateReceiver(alice.address);

      await time.increase(10 * WEEK);
      await grantsGauge.userCheckpoint(ZERO_ADDRESS);
      let totalEmissions = await grantsGauge.totalEmissions();

      await grantsGauge.transmitEmissions();
      let balance = await lt.balanceOf(alice.address);
      expect(balance).to.be.equal(totalEmissions);
    });
  });
});
