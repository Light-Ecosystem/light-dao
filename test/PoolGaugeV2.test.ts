import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { network, upgrades } from "hardhat";
import { PermitSigHelper } from "./PermitSigHelper";

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");


describe("PoolGauge", function () {
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

  describe("Set permit2 address", async () => {
    it("only owner can set", async () => {
      const { alice, poolGauge } = await loadFixture(deployOneYearLockFixture);
      await expect(poolGauge.connect(alice).setPermit2Address("0x000000000022D473030F116dDEE9F6B43aC78BA3")).to.be.revertedWith("Ownable: caller is not the owner");
    })
    it("can not set address zero", async () => {
      const { poolGauge } = await loadFixture(deployOneYearLockFixture);
      await expect(poolGauge.setPermit2Address(ethers.constants.AddressZero)).to.be.revertedWith("CE000");
    })
    it("set permit2 address success", async () => {
      const { poolGauge, permit2 } = await loadFixture(deployOneYearLockFixture);
      const newAddress = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
      await expect(poolGauge.setPermit2Address(newAddress)).to.be.emit(poolGauge, "SetPermit2Address")
        .withArgs(permit2.address, newAddress);
      expect(await poolGauge.permit2Address()).to.be.equal(newAddress);
    })
  })

  describe("test pool gauge", function () {

    it("test gauge integral ", async function () {
      const { lt, mockLpToken, gaugeController, poolGauge, owner, bob, periodTime, permit2 } = await loadFixture(deployOneYearLockFixture);

      let integral = BigNumber.from(0);
      let t0 = BigNumber.from(periodTime);
      let t0_rate = await lt.rate();
      let t0_supply = BigNumber.from("0");
      let t0_balance = BigNumber.from("0");

      let typeId = await gaugeController.nGaugeTypes();

      let weight = ethers.utils.parseEther("1");
      let gaugeWeight = ethers.utils.parseEther("1");

      await gaugeController.addType("Liquidity", BigNumber.from(0));
      await gaugeController.changeTypeWeight(typeId, weight);
      await gaugeController.addGauge(poolGauge.address, typeId, gaugeWeight);

      // console.log("owner lp token balance: " + await mockLpToken.balanceOf(owner.address));

      // Assume relative eight is 1
      async function updateIntegral() {
        let t1 = BigNumber.from(await time.latest());
        let rate1 = await lt.rate();
        let t_epoch = await lt.startEpochTime();
        let rate_x_time;

        if (t0 >= t_epoch) {
          rate_x_time = t1.sub(t0).mul(rate1);
        } else {
          // (t_epoch - t0) * t0_rate + (t1 - t_epoch) * rate1
          rate_x_time = t_epoch.sub(t0).mul(t0_rate).add(t1.sub(t_epoch).mul(rate1));
        }

        if (t0_supply.gt(BigNumber.from("0"))) {
          // integral = integral + rate_x_time * t0_balance / t0_supply;
          integral = integral.add(rate_x_time.mul(t0_balance).div(t0_supply));
        }
        t0_rate = rate1;
        t0 = t1;
        t0_supply = await poolGauge.totalSupply();
        t0_balance = await poolGauge.balanceOf(owner.address);
        // console.log("update_integral t0_supply" + t0_supply);
      }

      await time.increase(WEEK);
      let despostAmount = BigNumber.from(10);

      await mockLpToken.approve(poolGauge.address, despostAmount);
      // deposit
      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);
      const DEADLINE = await time.latest() + 60 * 60;
      const sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await updateIntegral();

      await poolGauge.userCheckpoint(owner.address);
      console.log("--------------------------------");

      // increase time
      let dt = WEEK;
      await time.increase(dt);

      await poolGauge.userCheckpoint(owner.address);
      await updateIntegral();
      expect(await poolGauge.integrateFraction(owner.address)).to.equal(integral);


      await poolGauge["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));
      await updateIntegral();
      expect(await poolGauge.integrateFraction(owner.address)).to.equal(integral);


      await time.increase(WEEK);
      await poolGauge.userCheckpoint(owner.address);
      await updateIntegral();
      expect(await poolGauge.integrateFraction(owner.address)).to.equal(integral);


      //expect(await poolGauge.integrateFraction(owner.address)).to.equal(integral);
      console.log("integral: " + integral + " integrateFraction : " + (await poolGauge.integrateFraction(owner.address)));

    });

    it("test mining with votelock", async () => {
      const { lt, veLT, mockLpToken, gaugeController, permit2, poolGauge, owner, bob } = await loadFixture(deployOneYearLockFixture);

      await time.increase(WEEK * 2 + 5);

      // Wire up Gauge to the controller to have proper rates and stuff

      let weight = ethers.utils.parseEther("1");
      let gaugeWeight = ethers.utils.parseEther("1");

      let typeId = await gaugeController.nGaugeTypes();
      await gaugeController.addType("Liquidity", BigNumber.from("0"));
      await gaugeController.changeTypeWeight(typeId, weight);
      await gaugeController.addGauge(poolGauge.address, typeId, gaugeWeight);

      // Prepare tokens
      let transferAmount = ethers.utils.parseEther("2");
      await lt.transfer(bob.address, transferAmount);
      await lt.approve(veLT.address, (await mockLpToken.balanceOf(owner.address)).div(BigNumber.from("2")));
      await lt.connect(bob).approve(veLT.address, ethers.constants.MaxUint256);
      await mockLpToken.transfer(bob.address, (await mockLpToken.balanceOf(owner.address)).div(BigNumber.from("2")));

      // Alice deposits to escrow. She now has a BOOST
      let t = await time.latest();
      const DEADLINE = await time.latest() + 60 * 60;
      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);
      let sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, transferAmount, NONCE, DEADLINE);
      await lt.approve(permit2.address, transferAmount);
      await veLT.createLock(transferAmount, t + WEEK * 2, NONCE, DEADLINE, sig);


      let depositAmount = ethers.utils.parseEther("4");

      // owner and Bob deposit some liquidity
      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGauge.address, depositAmount, NONCE, DEADLINE);
      await lt.approve(permit2.address, depositAmount);
      await mockLpToken.approve(permit2.address, depositAmount);
      await poolGauge["deposit(uint256,uint256,uint256,bytes,address)"](depositAmount, NONCE, DEADLINE, sig, owner.address);

      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      sig = await PermitSigHelper.signature(bob, mockLpToken.address, permit2.address, poolGauge.address, depositAmount, NONCE, DEADLINE);
      await mockLpToken.connect(bob).approve(permit2.address, depositAmount);
      await poolGauge.connect(bob)["deposit(uint256,uint256,uint256,bytes,address)"](depositAmount, NONCE, DEADLINE, sig, bob.address)
      //await poolGauge.connect(bob)["deposit(uint256,address)"](depositAmount, bob.address);

      let now = await time.latest();

      expect(await veLT.balanceOfAtTime(owner.address, now)).to.not.equal(ethers.constants.Zero);
      expect(await veLT.balanceOfAtTime(bob.address, now)).to.equal(ethers.constants.Zero);

      // Time travel and checkpoint
      // increase 4 weeks
      await time.increase(WEEK * 4);

      await network.provider.send("evm_setAutomine", [false]);
      await poolGauge.connect(bob).userCheckpoint(bob.address);
      await poolGauge.userCheckpoint(owner.address);
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);

      // 4 weeks down the road, balanceOf must be 0
      now = await time.latest();
      // now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      expect(await veLT.balanceOfAtTime(owner.address, now)).to.equal(ethers.constants.Zero);
      expect(await veLT.balanceOfAtTime(bob.address, now)).to.equal(ethers.constants.Zero);


      // Alice earned 2.5 times more lt because she vote-locked her lt
      let rewards_owner = await poolGauge.integrateFraction(owner.address);
      let rewards_bob = await poolGauge.integrateFraction(bob.address);
      expect(rewards_owner.mul(BigNumber.from("10000000000000000")).div(rewards_bob)).to.equal(
        BigNumber.from("25000000000000000")
      ); //approx = 1e-16

      // Time travel / checkpoint: no one has lt vote-locked
      await time.increase(WEEK * 4);

      await network.provider.send("evm_setAutomine", [false]);
      await poolGauge.connect(bob).userCheckpoint(bob.address);
      await poolGauge.userCheckpoint(owner.address);
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);

      let old_rewards_owner = rewards_owner;
      let old_rewards_bob = rewards_bob;

      //owner earned the same as Bob now
      rewards_owner = await poolGauge.integrateFraction(owner.address);
      rewards_bob = await poolGauge.integrateFraction(bob.address);
      let d_owner = rewards_owner.sub(old_rewards_owner);
      let d_bob = rewards_bob.sub(old_rewards_bob);
      expect(d_owner.sub(d_bob)).to.equal(ethers.constants.Zero);
    });

  });


});