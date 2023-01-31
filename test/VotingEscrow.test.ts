import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PermitSigHelper } from "./PermitSigHelper";

describe("VotingEscrow", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();

        let MyERC20LT = await ethers.getContractFactory("LT");
        const eRC20LT = await upgrades.deployProxy(MyERC20LT, ['LT Dao Token', 'LT']);
        await eRC20LT.deployed();
        await time.increase(86400);
        await eRC20LT.updateMiningParameters();

        const Permit2Contract = await ethers.getContractFactory("Permit2");
        const permit2 = await Permit2Contract.deploy();
        // console.log("Permit2 contract address: ", permit2.address);

        await eRC20LT.approve(permit2.address, ethers.constants.MaxUint256);

        const VeLT = await ethers.getContractFactory("VotingEscrow");
        const veLT = await VeLT.deploy(eRC20LT.address, permit2.address);
        await veLT.deployed();

        const WEEK = 7 * 86400;
        const MAXTIME = 4 * 365 * 86400;
        const BASE_RATE = 10000;

        return { veLT, eRC20LT, permit2, owner, otherAccount, WEEK, MAXTIME, BASE_RATE };
    }

    describe("create lock", function () {

        it("should revert right error when lock value is zero", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, BigNumber.from(0), NONCE, DEADLINE);

            await expect(veLT.createLock(0, WEEK, NONCE, DEADLINE, sig)).to.revertedWith("VE000");
        });

        it("should revert right error when locktime <= block.timestamp + WEEK", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, BigNumber.from(1000), NONCE, DEADLINE);

            let ti = await time.latest();
            await expect(veLT.createLock(1000, ti, NONCE, DEADLINE, sig)).to.revertedWith("VE002");
        });

        it("should revert right error when locktime >= 4 years", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, BigNumber.from(1000), NONCE, DEADLINE);

            let ti = await time.latest();

            await expect(veLT.createLock(1000, ti + MAXTIME + WEEK, NONCE, DEADLINE, sig)).to.revertedWith("VE003");
        });

        it("should revert right error when lock balance not withdraw", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, BigNumber.from(1000), NONCE, DEADLINE);

            let ti = await time.latest();
            veLT.createLock(1000, ti + WEEK * 10, NONCE, DEADLINE, sig);
            // console.log(ti - (ti % WEEK));
            await expect(veLT.createLock(1000, ti + WEEK * 10, NONCE, DEADLINE, sig)).to.revertedWith("VE001");
        });


        // it("create lock  success111", async function () {
        //     const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME, BASE_RATE } = await loadFixture(deployOneYearLockFixture);

        //     let value = ethers.utils.parseEther('1');
        //     let lockTime = 1693114159;
        //     let DEADLINE = 1693114159;
        //     let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
        //     // NONCE = BigNumber.from("12778218774815255949624976221294104492028877813736581432151906219706945250029");
        //     console.log("NONCE", NONCE.toString());
        //     const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

        //     console.log("VeLT balance of:", await veLT.balanceOf(owner.address));
        //     await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);
        //     console.log("VeLT balance of:", await veLT.balanceOf(owner.address));
        // })

        it("create lock  success", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME, BASE_RATE } = await loadFixture(deployOneYearLockFixture);

            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + MAXTIME;
            const CREATE_LOCK_TYPE = 1;

            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            console.log(DEADLINE);
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await expect(await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig)).to.emit(veLT, 'Deposit').withArgs(owner.address, owner.address, value, value, lockTime - (lockTime % WEEK), CREATE_LOCK_TYPE, anyValue);
            expect(await veLT.supply()).to.equal(value);
            expect(await eRC20LT.balanceOf(veLT.address)).to.equal(value);
            expect(await veLT.lockedEnd(owner.address)).to.equal(lockTime - (lockTime % WEEK));
            expect(await veLT.userPointEpoch(owner.address)).to.equal(1);
            let point = await veLT.userPointHistory(owner.address, 1);
            expect(point).to.have.property('slope').to.equal(value.div(MAXTIME * BASE_RATE));

            // let supplyPoint = await veLT.supplyPointHistory(1);
            // console.log(point);
            // console.log(supplyPoint);
            // let balance = ethers.utils.formatEther(await veLT.balanceOf(owner.address));
            // console.log(balance);
        });

        it("create lock v2", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            let value = ethers.utils.parseEther('1000');
            await eRC20LT.transfer(otherAccount.address, value);
            await eRC20LT.connect(otherAccount).approve(permit2.address, ethers.constants.MaxUint256);

            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(otherAccount, eRC20LT.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);

            let ti = await time.latest();
            let lockTime = ti + MAXTIME;
            // console.log(lockTime % WEEK);
            const CREATE_LOCK_TYPE = 1;
            await expect(await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig)).to.emit(veLT, 'Deposit').withArgs(owner.address, owner.address, value, value, lockTime - (lockTime % WEEK), CREATE_LOCK_TYPE, anyValue);
            await expect(await veLT.connect(otherAccount).createLock(value, lockTime, NONCE1, DEADLINE, sig1)).to.emit(veLT, 'Supply').withArgs(value, value.add(value));
            expect(await veLT.supply()).to.equal(value.add(value));
            expect(await veLT.lockedEnd(owner.address)).to.equal(lockTime - (lockTime % WEEK));
            let supplyPoint = await veLT.supplyPointHistory(2);
            let veLTSupply = await veLT.totalSupply();
            expect(supplyPoint).to.have.property('bias').to.equal(veLTSupply);
            // console.log(supplyPoint);
            let balance = ethers.utils.formatEther(await veLT.balanceOf(owner.address));
            // console.log(balance);
        });


    });

    describe("increase amount", function () {

        it("shoule revert right error when increaseAmount value is zero", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            let value = ethers.utils.parseEther('1000');
            let ti = await time.latest();

            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await expect(veLT.increaseAmount(0, NONCE, DEADLINE, sig)).to.revertedWith("VE000");
        });

        it("shoule revert right error when increaseAmount No existing lock found", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await expect(veLT.increaseAmount(value, NONCE, DEADLINE, sig)).to.revertedWith("VE004");
        });

        it("shoule revert right error when increaseAmount lock is expire", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + WEEK * 2;

            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);
            await time.increase(WEEK * 2);
            await expect(veLT.increaseAmount(value, NONCE1, DEADLINE, sig1)).to.revertedWith("VE005");
        });


        it("increaseAmount", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME, BASE_RATE } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            //increaseAmount
            let INCREASE_LOCK_AMOUNT = 2;
            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);
            await expect(await veLT.increaseAmount(value, NONCE1, DEADLINE, sig1)).to.emit(veLT, 'Deposit').withArgs(owner.address, owner.address, value, value.mul(2), lockTime - (lockTime % WEEK), INCREASE_LOCK_AMOUNT, anyValue);

            expect(await veLT.supply()).to.equal(value.mul(2));
            expect(await eRC20LT.balanceOf(veLT.address)).to.equal(value.mul(2));
            expect(await veLT.lockedEnd(owner.address)).to.equal(lockTime - (lockTime % WEEK));
            expect(await veLT.userPointEpoch(owner.address)).to.equal(2);
            let point = await veLT.userPointHistory(owner.address, 2);
            expect(point).to.have.property('slope').to.equal(value.mul(2).div(MAXTIME * BASE_RATE));
            // let supplyPoint = await veLT.supplyPointHistory(1);
        });

        it("increaseAmountFor", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME, BASE_RATE } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            let ti = await time.latest();
            let lockTime = ti + MAXTIME;

            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await veLT.createLockFor(otherAccount.address, value, lockTime, NONCE, DEADLINE, sig);

            //increaseAmount
            let INCREASE_LOCK_AMOUNT = 2;
            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);
            await expect(await veLT.increaseAmountFor(otherAccount.address, value, NONCE1, DEADLINE, sig1)).to.emit(veLT, 'Deposit').withArgs(owner.address, otherAccount.address, value, value.mul(2), lockTime - (lockTime % WEEK), INCREASE_LOCK_AMOUNT, anyValue);

            expect(await veLT.supply()).to.equal(value.mul(2));
            expect(await eRC20LT.balanceOf(veLT.address)).to.equal(value.mul(2));
            expect(await veLT.lockedEnd(otherAccount.address)).to.equal(lockTime - (lockTime % WEEK));
            expect(await veLT.userPointEpoch(otherAccount.address)).to.equal(2);
            let point = await veLT.userPointHistory(otherAccount.address, 2);
            expect(point).to.have.property('slope').to.equal(value.mul(2).div(MAXTIME * BASE_RATE));
            // let supplyPoint = await veLT.supplyPointHistory(1);
        });

    });

    describe("increaseUnlockTime", function () {

        it("shoule revert right error when Lock expired", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME, BASE_RATE } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + WEEK * 2;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            //test
            await time.increase(WEEK * 2);
            await expect(veLT.increaseUnlockTime(MAXTIME)).to.revertedWith("VE006");
        });

        it("shoule revert right error when  Nothing is locked", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + WEEK * 2;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            // await time.increase(WEEK * 2);
            // await veLT.withdraw();

            // will never happend
            // await expect(veLT.increaseUnlockTime(MAXTIME)).to.revertedWith("Nothing is locked");
        });

        it("shoule revert right error when decrease lock duration", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            await expect(veLT.increaseUnlockTime(WEEK * 10)).to.revertedWith("VE008");
        });

        it("shoule revert right error when Voting lock can be 4 years max", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + WEEK * 10;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            lockTime = await time.latest() + MAXTIME + WEEK;

            await expect(veLT.increaseUnlockTime(lockTime)).to.revertedWith("VE009");
        });


        it("increaseUnlockTime", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME, BASE_RATE } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + 10 * WEEK;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);

            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            //test
            lockTime = await time.latest() + MAXTIME;
            let INCREASE_UNLOCK_TIME = 3;
            await expect(await veLT.increaseUnlockTime(lockTime)).to.emit(veLT, 'Deposit').withArgs(owner.address, owner.address, 0, value, lockTime - (lockTime % WEEK), INCREASE_UNLOCK_TIME, anyValue);

            expect(await eRC20LT.balanceOf(veLT.address)).to.equal(value);
            expect(await veLT.lockedEnd(owner.address)).to.equal(lockTime - (lockTime % WEEK));
            expect(await veLT.userPointEpoch(owner.address)).to.equal(2);
            let point = await veLT.userPointHistory(owner.address, 2);
            expect(point).to.have.property('slope').to.equal(value.div(MAXTIME * BASE_RATE));
        });

    });


    describe("withdraw", function () {

        it("shoule revert right error when lock didn't expire", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + WEEK * 2;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            await expect(veLT.withdraw()).to.revertedWith("VE010");
        });

        it("withdraw zero value", async function () {
            const { veLT, eRC20LT, owner, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            await expect(await veLT.withdraw()).to.emit(veLT, "Withdraw").withArgs(owner.address, 0, anyValue);
            await expect(await veLT.withdraw()).to.emit(veLT, "Supply").withArgs(0, 0);
            expect(await veLT.userPointEpoch(owner.address)).to.equal(2);
            let point = await veLT.userPointHistory(owner.address, 2);
            expect(point).to.have.property('slope').to.equal(0);
            let totalEpoch = await veLT.epoch();
            // let supplyPoint = await veLT.supplyPointHistory(totalEpoch);
            // console.log(supplyPoint);

        });

        it("withdraw", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + WEEK * 2;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);
            await time.increaseTo(lockTime);

            await expect(await veLT.withdraw()).to.emit(veLT, "Withdraw").withArgs(owner.address, value, anyValue).to.emit(veLT, "Supply").withArgs(value, 0);
            expect(await eRC20LT.balanceOf(veLT.address)).to.equal(0);
            expect(await veLT.lockedEnd(owner.address)).to.equal(0);
            expect(await veLT.userPointEpoch(owner.address)).to.equal(2);
            let point = await veLT.userPointHistory(owner.address, 2);
            expect(point).to.have.property('slope').to.equal(0);
        });

    });



    describe("balanceOf", function () {

        it("balanceOf zero", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            expect(await veLT.balanceOf(owner.address)).to.equal(0);
        });

        it("balanceOf zero when expire", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + WEEK * 2;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);
            await time.increaseTo(lockTime);

            expect(await veLT.balanceOf(owner.address)).to.equal(0);
        });

        it("balanceOf", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let tt = ti % WEEK;
            await time.setNextBlockTimestamp(ti - tt + WEEK);
            let lockTime = ti - tt + WEEK + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);


            let end = await veLT.lockedEnd(owner.address);
            let slope = await veLT.getLastUserSlope(owner.address);
            let point = await veLT.userPointHistory(owner.address, 1);
            expect(point).to.have.property('ts').to.equal(ti - tt + WEEK);
            expect(await veLT.balanceOf(owner.address)).to.equal(slope.mul(MAXTIME - (lockTime - end.toNumber())));

            await time.increase(100);
            expect(await veLT.balanceOf(owner.address)).to.equal(slope.mul(MAXTIME - (lockTime - end.toNumber() + 100)));

            await time.increase(MAXTIME);
            expect(await veLT.balanceOf(owner.address)).to.equal(0);
        });


        it("balanceOfAtTime zero", async function () {
            const { veLT, eRC20LT, owner, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            expect(await veLT.balanceOfAtTime(owner.address, 0)).to.equal(0);
        });

        it("balanceOfAtTime zero when expire", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let lockTime = ti + WEEK * 2;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            await time.increaseTo(lockTime);

            expect(await veLT.balanceOfAtTime(owner.address, 0)).to.equal(0);
        });

        it("balanceOfAtTime", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME, BASE_RATE } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let tt = ti % WEEK;
            await time.setNextBlockTimestamp(ti - tt + WEEK);
            let lockTime = ti - tt + WEEK + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let end = await veLT.lockedEnd(owner.address);
            let slope = await veLT.getLastUserSlope(owner.address);
            let point = await veLT.userPointHistory(owner.address, 1);
            let ts = ti - tt + WEEK;
            expect(point).to.have.property('ts').to.equal(ts);
            expect(point).to.have.property('slope').to.equal(value.div(MAXTIME * BASE_RATE));
            expect(await veLT.balanceOfAtTime(owner.address, 0)).to.equal(slope.mul(MAXTIME - (lockTime - end.toNumber())));

            expect(await veLT.balanceOfAtTime(owner.address, ts - (lockTime - end.toNumber()))).to.equal(slope.mul(MAXTIME));
            // expect(slope.mul(MAXTIME)).to.equal(value);

            let lastTime = await time.latest();
            expect(await veLT.balanceOfAtTime(owner.address, lastTime + 100)).to.equal(slope.mul(MAXTIME - (lockTime - end.toNumber() + 100)));

            expect(await veLT.balanceOfAtTime(owner.address, lastTime + MAXTIME)).to.equal(0);
        });

        it("shoule revert right error when balanceOfAt exceed lasted block", async function () {
            const { veLT, eRC20LT, owner, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            await expect(veLT.balanceOfAt(owner.address, 10000)).to.revertedWith("VE011");

        });

        it("balanceOfAt block", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let tt = ti % WEEK;
            await time.setNextBlockTimestamp(ti - tt + WEEK);
            let lockTime = ti - tt + WEEK + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let slope = await veLT.getLastUserSlope(owner.address);
            let point = await veLT.userPointHistory(owner.address, 1);
            let blk = point['blk'];
            let end = await veLT.lockedEnd(owner.address);
            expect(await veLT.balanceOfAt(owner.address, blk)).to.equal(slope.mul(MAXTIME - (lockTime - end.toNumber())));

            await time.increase(12);
            await time.increase(12);
            await time.increase(12);
            await time.increase(12);
            await time.increase(12);
            expect(await veLT.balanceOfAt(owner.address, blk.add(5))).to.equal(slope.mul(MAXTIME - (lockTime - end.toNumber()) - 12 * 5));

            expect(await veLT.balanceOfAt(owner.address, blk.sub(2))).to.equal(0);

        });
    });


    describe("supply", function () {

        it("totalSupply", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let tt = ti % WEEK;
            await time.setNextBlockTimestamp(ti - tt + WEEK);
            let lockTime = ti - tt + WEEK + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let slope = await veLT.getLastUserSlope(owner.address);
            let end = await veLT.lockedEnd(owner.address);

            expect(await veLT.totalSupply()).to.equal(slope.mul(MAXTIME - (lockTime - end.toNumber())));
            let b1 = slope.mul(MAXTIME - (lockTime - end.toNumber()) - WEEK);

            ti = await time.latest();
            tt = ti % WEEK;
            await time.setNextBlockTimestamp(ti - tt + WEEK);
            lockTime = ti - tt + WEEK + MAXTIME;
            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);
            await veLT.createLockFor(otherAccount.address, value, lockTime, NONCE1, DEADLINE, sig1);
            slope = await veLT.getLastUserSlope(otherAccount.address);
            end = await veLT.lockedEnd(otherAccount.address);
            let b2 = slope.mul(MAXTIME - (lockTime - end.toNumber()));
            expect(await veLT.balanceOf(otherAccount.address)).to.equal(b2);
            expect(await veLT.totalSupply()).to.equal(b1.add(b2));

        });


        it("totalSupplyAtTime", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let tt = ti % WEEK;
            await time.setNextBlockTimestamp(ti - tt + WEEK);
            let lockTime = ti - tt + WEEK + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let slope = await veLT.getLastUserSlope(owner.address);
            let end = await veLT.lockedEnd(owner.address);
            let firstEnd = end;

            expect(await veLT.totalSupplyAtTime(0)).to.equal(slope.mul(MAXTIME - (lockTime - end.toNumber())));
            let b1 = slope.mul(MAXTIME - (lockTime - end.toNumber()) - WEEK);

            await eRC20LT.approve(veLT.address, value);
            ti = await time.latest();
            tt = ti % WEEK;
            await time.setNextBlockTimestamp(ti - tt + WEEK);
            lockTime = ti - tt + WEEK + MAXTIME;
            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);
            await veLT.createLockFor(otherAccount.address, value, lockTime, NONCE1, DEADLINE, sig1);

            slope = await veLT.getLastUserSlope(otherAccount.address);
            end = await veLT.lockedEnd(otherAccount.address);
            let b2 = slope.mul(MAXTIME - (lockTime - end.toNumber()));
            expect(await veLT.balanceOf(otherAccount.address)).to.equal(b2);
            expect(await veLT.totalSupplyAtTime(0)).to.equal(b1.add(b2));

            expect(await veLT.totalSupplyAtTime(ti - tt + WEEK + WEEK * 10)).to.equal(b1.add(b2).sub(slope.mul(2).mul(WEEK * 10)));
            expect(await veLT.totalSupplyAtTime(ti - tt + WEEK + MAXTIME)).to.equal(0);
            expect(await veLT.totalSupplyAtTime(firstEnd)).to.equal(slope.mul(WEEK));
        });


        it("shoule revert right error when totalSupplyAt exceed lasted block", async function () {
            const { veLT, eRC20LT, owner, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            await expect(veLT.totalSupplyAt(10000)).to.revertedWith("VE011");
        });

        it("totalSupplyAt", async function () {
            const { veLT, eRC20LT, owner, permit2, otherAccount, WEEK, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            //prepare init data
            let value = ethers.utils.parseEther('1000');
            await eRC20LT.approve(veLT.address, value);
            let ti = await time.latest();
            let tt = ti % WEEK;
            await time.setNextBlockTimestamp(ti - tt + WEEK);
            let lockTime = ti - tt + WEEK + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let slope = await veLT.getLastUserSlope(owner.address);
            let end = await veLT.lockedEnd(owner.address);
            let point = await veLT.userPointHistory(owner.address, 1);
            let blk = point['blk'];

            expect(await veLT.totalSupplyAt(blk)).to.equal(slope.mul(MAXTIME - (lockTime - end.toNumber())));
            let b1 = slope.mul(MAXTIME - (lockTime - end.toNumber()) - WEEK);

            await eRC20LT.approve(veLT.address, value);
            ti = await time.latest();
            tt = ti % WEEK;
            await time.setNextBlockTimestamp(ti - tt + WEEK);
            lockTime = ti - tt + WEEK + MAXTIME;
            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);
            await veLT.createLockFor(otherAccount.address, value, lockTime, NONCE1, DEADLINE, sig1);

            slope = await veLT.getLastUserSlope(otherAccount.address);
            end = await veLT.lockedEnd(otherAccount.address);
            let b2 = slope.mul(MAXTIME - (lockTime - end.toNumber()));
            expect(await veLT.balanceOf(otherAccount.address)).to.equal(b2);
            expect(await veLT.totalSupplyAt(blk.add(2))).to.equal(b1.add(b2));

            await time.increase(12);
            await time.increase(12);
            await time.increase(12);
            await time.increase(12);
            await time.increase(12);
            expect(await veLT.totalSupplyAt(blk.add(2))).to.equal(b1.add(b2));
            expect(await veLT.totalSupplyAt(blk.add(2 + 5))).to.equal(b1.add(b2).sub(slope.mul(2).mul(12 * 5)));
        });

    });


});
