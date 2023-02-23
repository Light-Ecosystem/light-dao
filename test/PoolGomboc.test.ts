import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { network, upgrades } from "hardhat";
import { PermitSigHelper } from "./PermitSigHelper";

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");


describe("PoolGomboc", function () {
  const DAY = 86400;
  const WEEK = DAY * 7;

  async function deployOneYearLockFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MyERC20LT = await ethers.getContractFactory("LT");
    const VeLT = await ethers.getContractFactory("VotingEscrow");
    const GombocController = await ethers.getContractFactory("GombocController");
    const PoolGomboc = await ethers.getContractFactory("PoolGomboc");
    const TestLP = await ethers.getContractFactory("MockLP");
    const Minter = await ethers.getContractFactory("Minter");
    const GombocFactory = await ethers.getContractFactory("GombocFactory");

    // init 1000
    const mockLpToken = await TestLP.deploy("USED/DAI Pair", "uni pair", 18, 1000000); //Not using the actual InsureDAO contract


    const lt = await upgrades.deployProxy(MyERC20LT, ["LT Dao Token", "LT"]);
    await lt.deployed();
    await time.increase(DAY);
    await lt.updateMiningParameters();

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

    // deploy gomboc factory
    const gombocFactory = await GombocFactory.deploy(poolGombocImplementation.address, minter.address, permit2.address);
    await gombocFactory.deployed();

    // deploy pool gomboc by Factory
    await gombocFactory.createPool(mockLpToken.address);
    // get pool address
    const poolGombocAddress = await gombocFactory.getPool(mockLpToken.address);
    // load pool gomboc
    const poolGomboc = PoolGomboc.attach(poolGombocAddress);
    const periodTime = await time.latest();
    return { lt, permit2, veLT, gombocController, mockLpToken, minter, poolGomboc, owner, alice, bob, periodTime };
  }

  describe("Set permit2 address", async () => {
    it("only owner can set", async () => {
      const { alice, poolGomboc } = await loadFixture(deployOneYearLockFixture);
      await expect(poolGomboc.connect(alice).setPermit2Address("0x000000000022D473030F116dDEE9F6B43aC78BA3")).to.be.revertedWith("Ownable: caller is not the owner");
    })
    it("can not set address zero", async () => {
      const { poolGomboc } = await loadFixture(deployOneYearLockFixture);
      await expect(poolGomboc.setPermit2Address(ethers.constants.AddressZero)).to.be.revertedWith("CE000");
    })
    it("set permit2 address success", async () => {
      const { poolGomboc, permit2 } = await loadFixture(deployOneYearLockFixture);
      const newAddress = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
      await expect(poolGomboc.setPermit2Address(newAddress)).to.be.emit(poolGomboc, "SetPermit2Address")
        .withArgs(permit2.address, newAddress);
      expect(await poolGomboc.permit2Address()).to.be.equal(newAddress);
    })
  })

  describe("test pool gomboc", function () {

    it("test gomboc integral ", async function () {
      const { lt, mockLpToken, gombocController, poolGomboc, owner, bob, periodTime, permit2 } = await loadFixture(deployOneYearLockFixture);

      let integral = BigNumber.from(0);
      let t0 = BigNumber.from(periodTime);
      let t0_rate = await lt.rate();
      let t0_supply = BigNumber.from("0");
      let t0_balance = BigNumber.from("0");

      let typeId = await gombocController.nGombocTypes();

      let weight = ethers.utils.parseEther("1");
      let gombocWeight = ethers.utils.parseEther("1");

      await gombocController.addType("Liquidity", BigNumber.from(0));
      await gombocController.changeTypeWeight(typeId, weight);
      await gombocController.addGomboc(poolGomboc.address, typeId, gombocWeight);

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
        t0_supply = await poolGomboc.totalSupply();
        t0_balance = await poolGomboc.balanceOf(owner.address);
        // console.log("update_integral t0_supply" + t0_supply);
      }

      await time.increase(WEEK);
      let despostAmount = BigNumber.from(10);

      await mockLpToken.approve(poolGomboc.address, despostAmount);
      // deposit
      let random = ethers.utils.randomBytes(32);
      let NONCE = BigNumber.from(random);
      const DEADLINE = await time.latest() + 60 * 60;
      const sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGomboc.address, despostAmount, NONCE, DEADLINE);
      await mockLpToken.approve(permit2.address, despostAmount);
      await poolGomboc["deposit(uint256,uint256,uint256,bytes)"](despostAmount, NONCE, DEADLINE, sig);
      await updateIntegral();

      await poolGomboc.userCheckpoint(owner.address);
      console.log("--------------------------------");

      // increase time
      let dt = WEEK;
      await time.increase(dt);

      await poolGomboc.userCheckpoint(owner.address);
      await updateIntegral();
      expect(await poolGomboc.integrateFraction(owner.address)).to.equal(integral);


      await poolGomboc["withdraw(uint256)"](despostAmount.div(BigNumber.from(2)));
      await updateIntegral();
      expect(await poolGomboc.integrateFraction(owner.address)).to.equal(integral);


      await time.increase(WEEK);
      await poolGomboc.userCheckpoint(owner.address);
      await updateIntegral();
      expect(await poolGomboc.integrateFraction(owner.address)).to.equal(integral);


      //expect(await poolGomboc.integrateFraction(owner.address)).to.equal(integral);
      console.log("integral: " + integral + " integrateFraction : " + (await poolGomboc.integrateFraction(owner.address)));

    });

    it("test mining with votelock", async () => {
      const { lt, veLT, mockLpToken, gombocController, permit2, poolGomboc, owner, bob } = await loadFixture(deployOneYearLockFixture);

      await time.increase(WEEK * 2 + 5);

      // Wire up Gauge to the controller to have proper rates and stuff

      let weight = ethers.utils.parseEther("1");
      let gombocWeight = ethers.utils.parseEther("1");

      let typeId = await gombocController.nGombocTypes();
      await gombocController.addType("Liquidity", BigNumber.from("0"));
      await gombocController.changeTypeWeight(typeId, weight);
      await gombocController.addGomboc(poolGomboc.address, typeId, gombocWeight);

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
      sig = await PermitSigHelper.signature(owner, mockLpToken.address, permit2.address, poolGomboc.address, depositAmount, NONCE, DEADLINE);
      await lt.approve(permit2.address, depositAmount);
      await mockLpToken.approve(permit2.address, depositAmount);
      await poolGomboc["deposit(uint256,uint256,uint256,bytes,address)"](depositAmount, NONCE, DEADLINE, sig, owner.address);

      random = ethers.utils.randomBytes(32);
      NONCE = BigNumber.from(random);
      sig = await PermitSigHelper.signature(bob, mockLpToken.address, permit2.address, poolGomboc.address, depositAmount, NONCE, DEADLINE);
      await mockLpToken.connect(bob).approve(permit2.address, depositAmount);
      await poolGomboc.connect(bob)["deposit(uint256,uint256,uint256,bytes,address)"](depositAmount, NONCE, DEADLINE, sig, bob.address)
      //await poolGomboc.connect(bob)["deposit(uint256,address)"](depositAmount, bob.address);

      let now = await time.latest();

      expect(await veLT.balanceOfAtTime(owner.address, now)).to.not.equal(ethers.constants.Zero);
      expect(await veLT.balanceOfAtTime(bob.address, now)).to.equal(ethers.constants.Zero);

      // Time travel and checkpoint
      // increase 4 weeks
      await time.increase(WEEK * 4);

      await network.provider.send("evm_setAutomine", [false]);
      await poolGomboc.connect(bob).userCheckpoint(bob.address);
      await poolGomboc.userCheckpoint(owner.address);
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);

      // 4 weeks down the road, balanceOf must be 0
      now = await time.latest();
      // now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      expect(await veLT.balanceOfAtTime(owner.address, now)).to.equal(ethers.constants.Zero);
      expect(await veLT.balanceOfAtTime(bob.address, now)).to.equal(ethers.constants.Zero);


      // Alice earned 2.5 times more lt because she vote-locked her lt
      let rewards_owner = await poolGomboc.integrateFraction(owner.address);
      let rewards_bob = await poolGomboc.integrateFraction(bob.address);
      expect(rewards_owner.mul(BigNumber.from("10000000000000000")).div(rewards_bob)).to.equal(
        BigNumber.from("25000000000000000")
      ); //approx = 1e-16

      // Time travel / checkpoint: no one has lt vote-locked
      await time.increase(WEEK * 4);

      await network.provider.send("evm_setAutomine", [false]);
      await poolGomboc.connect(bob).userCheckpoint(bob.address);
      await poolGomboc.userCheckpoint(owner.address);
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);

      let old_rewards_owner = rewards_owner;
      let old_rewards_bob = rewards_bob;

      //owner earned the same as Bob now
      rewards_owner = await poolGomboc.integrateFraction(owner.address);
      rewards_bob = await poolGomboc.integrateFraction(bob.address);
      let d_owner = rewards_owner.sub(old_rewards_owner);
      let d_bob = rewards_bob.sub(old_rewards_bob);
      expect(d_owner.sub(d_bob)).to.equal(ethers.constants.Zero);
    });

  });


});