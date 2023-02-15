import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { network, upgrades } from "hardhat";
import { PermitSigHelper } from "./PermitSigHelper";

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");


describe("PoolGomboc", function() {
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
    const Ownership = await ethers.getContractFactory("Ownership");

    const ownership = await Ownership.deploy();
    await ownership.deployed();

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
    await ownership.deployed();
    const gombocFactory = await GombocFactory.deploy(poolGombocImplementation.address, minter.address, permit2.address);
    await gombocFactory.deployed();

    // deploy pool gomboc by Factory
    await gombocFactory.createPool(mockLpToken.address, ownership.address);
    // get pool address
    const poolGombocAddress = await gombocFactory.getPool(mockLpToken.address);
    // load pool gomboc
    const poolGomboc = PoolGomboc.attach(poolGombocAddress);

    const periodTime = await time.latest();
    return { lt, permit2, veLT, gombocController, mockLpToken, minter, poolGomboc, owner, alice, bob, periodTime, ownership };
  }


  describe("test pool gomboc", function() {

    it("test gomboc integral ", async function() {
      const {
        lt,
        mockLpToken,
        gombocController,
        poolGomboc,
        owner,
        bob,
        periodTime,
        permit2
      } = await loadFixture(deployOneYearLockFixture);

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

    // it("test random gomboc integral", async () => {
    //   const { lt, mockLpToken, gombocController, poolGomboc, owner, bob, periodTime } = await loadFixture(deployOneYearLockFixture);
    //
    //   let owner_staked = BigNumber.from("0");
    //   let bob_staked = BigNumber.from("0");
    //   let integral = BigNumber.from("0");
    //   let t0 = BigNumber.from(periodTime);
    //   let t0_rate = await lt.rate();
    //   //console.log("t0_rate: " + t0_rate);
    //   let t0_supply = BigNumber.from("0");
    //   let t0_balance = BigNumber.from("0");
    //
    //   let typeId = await gombocController.nGombocTypes();
    //   await gombocController.addType("Liquidity", BigNumber.from("0"));
    //   await gombocController.changeTypeWeight(typeId, ten_to_the_18);
    //   await gombocController.addGomboc(poolGomboc.address, typeId, ten_to_the_18);
    //
    //   // console.log("bengin owner mock lp token balance: " + await mockLpToken.balanceOf(owner.address));
    //   // console.log("bengin bob mock lp token balance: " + await mockLpToken.balanceOf(bob.address));
    //
    //   await mockLpToken.transfer(bob.address, (await mockLpToken.balanceOf(owner.address)).div(BigNumber.from("2")));
    //
    //   // console.log("after owner mock lp token balance: " + await mockLpToken.balanceOf(owner.address));
    //   // console.log("after bob mock lp token balance: " + await mockLpToken.balanceOf(bob.address));
    //
    //   async function update_integral() {
    //     let t1 = BigNumber.from(await time.latest());
    //     let rate1 = await lt.rate();
    //     let t_epoch = await lt.startEpochTime();
    //     let rate_x_time;
    //
    //     if (t0 >= t_epoch) {
    //       rate_x_time = t1.sub(t0).mul(rate1);
    //     } else {
    //       // (t_epoch - t0) * t0_rate + (t1 - t_epoch) * rate1
    //       rate_x_time = t_epoch.sub(t0).mul(t0_rate).add(t1.sub(t_epoch).mul(rate1));
    //     }
    //
    //     if (t0_supply.gt(BigNumber.from("0"))) {
    //       // integral = integral + rate_x_time * t0_balance / t0_supply;
    //       integral = integral.add(BigNumber.from(rate_x_time).mul(t0_balance).div(t0_supply));
    //     }
    //
    //     t0_rate = rate1;
    //     t0 = t1;
    //     t0_supply = await poolGomboc.totalSupply();
    //     t0_balance = await poolGomboc.balanceOf(owner.address);
    //     // console.log("update_integral t0_supply" + t0_supply);
    //     //console.log("update_integral owner balance" + t0_balance);
    //   }
    //
    //   await time.increase(WEEK);
    //
    //   // Now let's have a loop where Bob always deposit or withdraws,and owner does so more rarely
    //   for (let i = 0; i < 10; i++) {
    //     // console.log("Math.random():" + Math.random());
    //     let is_owner = Math.random() < 0.5;
    //     let dt = BigNumber.from(Math.floor(Math.random() * 86400 * 73).toString()).add(BigNumber.from("1"));
    //     console.log("dt: " + dt.toNumber());
    //     await time.increase(dt.toNumber());
    //     //await ethers.provider.send("evm_increaseTime", [dt.toNumber()]);
    //
    //     // For Bob
    //     let is_withdraw = i > 0 && Math.random() < 0.5; //(i > 0) * (random() < 0.5)
    //
    //     if (is_withdraw) {
    //       // withdraw
    //       const bobBanlance = await poolGomboc.balanceOf(bob.address);
    //       if (bobBanlance > 0) {
    //         console.log("Bob Withdraws");
    //         let amount = BigNumber.from(Math.floor(Math.random() * 10000).toString())
    //           .mul(await poolGomboc.balanceOf(bob.address))
    //           .div(BigNumber.from("10000"));
    //         console.log("Bob Withdraws " + amount.div(BigNumber.from("10").pow("18")).toNumber());
    //         // await poolGomboc.connect(bob).withdraw(amount);
    //         await poolGomboc.connect(bob)["withdraw(uint256)"](amount);
    //         await update_integral();
    //         bob_staked = bob_staked.sub(amount);
    //         console.log("--------------------> bob:" + bob_staked.div(BigNumber.from("10").pow("18")).toNumber());
    //       }
    //     } else {
    //       // deposit
    //       console.log("Bob deposit");
    //       let amount = BigNumber.from(Math.floor(Math.random() * 10000).toString())
    //         .mul(await mockLpToken.balanceOf(bob.address))
    //         .div(BigNumber.from("10"))
    //         .div(BigNumber.from("10000"));
    //       console.log("Bob Deposits " + amount.div(BigNumber.from("10").pow("18")).toNumber());
    //       await mockLpToken.connect(bob).approve(poolGomboc.address, amount);
    //
    //       // console.log("lt rate: " + await lt.rate());
    //       // await poolGomboc.connect(bob).deposit(amount, bob.address);
    //       await poolGomboc.connect(bob)["deposit(uint256,address)"](amount, bob.address);
    //       // console.log("lt rate: " + await lt.rate());
    //       // console.log("poolGomboc balanceOf bob: " + await poolGomboc.balanceOf(bob.address));
    //
    //       await update_integral();
    //       bob_staked = bob_staked.add(amount);
    //       console.log("--------------------> bob:" + bob_staked.div(BigNumber.from("10").pow("18")).toNumber());
    //     }
    //
    //     if (is_owner) {
    //       //For owner
    //       let is_withdraw_owner = (await poolGomboc.balanceOf(owner.address)) > 0 && Math.random() > 0.5;
    //       if (is_withdraw_owner) {
    //         console.log("Owner Withdraws");
    //         let amount_owner = BigNumber.from(Math.floor(Math.random() * 10000).toString())
    //           .mul(await poolGomboc.balanceOf(owner.address))
    //           .div(BigNumber.from("10"))
    //           .div(BigNumber.from("10000"));
    //         //await poolGomboc.withdraw(amount_owner);
    //         await poolGomboc["withdraw(uint256)"](amount_owner);
    //         await update_integral();
    //         owner_staked = owner_staked.sub(amount_owner);
    //         console.log("--------------------> owner:" + owner_staked.div(BigNumber.from("10").pow("18")).toNumber());
    //       } else {
    //         console.log("Owner Deposits");
    //         let amount_owner = BigNumber.from(Math.floor(Math.random() * 10000).toString())
    //           .mul(await mockLpToken.balanceOf(owner.address))
    //           .div(BigNumber.from("10000"));
    //
    //         //console.log("owner balance :" + await mockLpToken.balanceOf(owner.address));
    //         //console.log("amount_owner :" + amount_owner);
    //
    //         await mockLpToken.approve(poolGomboc.address, amount_owner);
    //         // await poolGomboc.deposit(amount_owner, owner.address);
    //         await poolGomboc["deposit(uint256,address)"](amount_owner, owner.address);
    //         await update_integral();
    //         owner_staked = owner_staked.add(amount_owner);
    //         console.log("--------------------> owner:" + owner_staked.div(BigNumber.from("10").pow("18")).toNumber());
    //       }
    //     }
    //
    //     // Checking that updating the checkpoint in the same second does nothing
    //     // Also everyone can update: that should make no difference, too
    //     if (Math.random() < 0.5) {
    //       await poolGomboc.userCheckpoint(owner.address);
    //     }
    //     if (Math.random() < 0.5) {
    //       await poolGomboc.connect(bob).userCheckpoint(bob.address);
    //     }
    //
    //     expect(await poolGomboc.balanceOf(owner.address)).to.equal(owner_staked);
    //     expect(await poolGomboc.balanceOf(bob.address)).to.equal(bob_staked);
    //     expect(await poolGomboc.totalSupply()).to.equal(owner_staked.add(bob_staked));
    //
    //     dt = BigNumber.from(Math.floor(Math.random() * 86400 * 19).toString()).add(BigNumber.from("1"));
    //
    //     await time.increase(dt.toNumber());
    //
    //     await poolGomboc.userCheckpoint(owner.address);
    //     await update_integral();
    //     //approx 1e-20
    //     //expect(await poolGomboc.integrateFraction(owner.address)).to.equal(integral);
    //     console.log("times:" + i + " dt/86400: " + dt / 86400 + " integral: " + integral + " integrateFraction : " + (await poolGomboc.integrateFraction(owner.address)));
    //   }
    // });

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
      await poolGomboc.connect(bob)["deposit(uint256,uint256,uint256,bytes,address)"](depositAmount, NONCE, DEADLINE, sig, bob.address);
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

  it("should ownership is right", async function() {
    const { poolGomboc, ownership } = await loadFixture(deployOneYearLockFixture);

    const gombocOwnership =  await poolGomboc.ownership();
    expect(await poolGomboc.ownership()).to.equal(ownership.address);



  });


});