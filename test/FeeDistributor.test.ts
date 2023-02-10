import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { PermitSigHelper } from "./PermitSigHelper";
import { BigNumber } from "ethers";

describe("FeeDistributor", function () {

    /// We define a fixture to reuse the same setup in every test.
    /// We use loadFixture to run this setup once, snapshot that state,
    /// and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, alice, bob] = await ethers.getSigners();

        let LT = await ethers.getContractFactory("LT");
        const VeLT = await ethers.getContractFactory("VotingEscrow");
        const GombocController = await ethers.getContractFactory("GombocController");
        const Minter = await ethers.getContractFactory("Minter");
        const StakingHOPE = await ethers.getContractFactory("StakingHOPE");
        const HOPE = await ethers.getContractFactory("HOPE");
        const RestrictedList = await ethers.getContractFactory("RestrictedList");
        const Admin = await ethers.getContractFactory("Admin");
        const FeeDistributor = await ethers.getContractFactory("FeeDistributor");

        ///deploy permit contract
        const Permit2Contract = await ethers.getContractFactory("Permit2");
        const permit2 = await Permit2Contract.deploy();

        ///deploy LT contract
        const lt = await upgrades.deployProxy(LT, ['LT Dao Token', 'LT']);
        await lt.deployed();
        await time.increase(86400);
        await lt.updateMiningParameters();
        await lt.approve(permit2.address, ethers.constants.MaxUint256);

        ///deploy VeLT contract
        const veLT = await VeLT.deploy(lt.address, permit2.address);
        await veLT.deployed();

        ///deploy gombocController contract
        const gombocController = await GombocController.deploy(lt.address, veLT.address);
        await gombocController.deployed();

        ///delopy minter contract
        const minter = await Minter.deploy(lt.address, gombocController.address);
        await minter.deployed();

        /// deploy hope contract
        const restrictedList = await RestrictedList.deploy();
        const hopeToken = await upgrades.deployProxy(HOPE, [restrictedList.address]);
        await hopeToken.deployed();

        // approve owner, alice, bob
        await hopeToken.approve(permit2.address, ethers.constants.MaxUint256);
        await hopeToken.connect(alice).approve(permit2.address, ethers.constants.MaxUint256);
        await hopeToken.connect(bob).approve(permit2.address, ethers.constants.MaxUint256);

        ///grantAgnet admin  and mint hope
        const admin = await Admin.deploy(hopeToken.address);
        let MINT_AMOUNT = ethers.utils.parseEther("1000000");
        const effectiveBlock = await time.latestBlock();
        const expirationBlock = effectiveBlock + 1000000;
        await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);
        await admin.mint(owner.address, ethers.utils.parseEther("10000"));
        await admin.mint(bob.address, ethers.utils.parseEther("100000"));

        ///deploy stakingHOPE contract
        const stakingHope = await StakingHOPE.deploy(hopeToken.address, minter.address, permit2.address);
        await stakingHope.deployed();

        //deploy feeDistributor contract
        let startTime = await time.latest();
        const feeDistributor = await upgrades.deployProxy(FeeDistributor, [veLT.address, startTime, hopeToken.address, stakingHope.address, bob.address]);
        await feeDistributor.deployed();

        const WEEK = 7 * 86400;
        const MAXTIME = 4 * 365 * 86400;
        return { owner, alice, bob, hopeToken, stakingHope, lt, veLT, permit2, feeDistributor, WEEK, MAXTIME }
    }

    describe("checkpointToken", async function () {

        it("should revert right error when checkpoint by caller is not owner", async function () {
            const { owner, alice, bob, feeDistributor } = await loadFixture(deployOneYearLockFixture);

            await expect(feeDistributor.connect(alice).checkpointToken()).to.revertedWith("FD001");
        });

        it("should revert right error when checkpoint too often", async function () {
            const { owner, alice, bob, feeDistributor } = await loadFixture(deployOneYearLockFixture);

            await feeDistributor.checkpointToken();
            await feeDistributor.toggleAllowCheckpointToken();
            await expect(feeDistributor.connect(alice).checkpointToken()).to.revertedWith("FD001");
        });

        it("less than one week for checkpoint", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await feeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.approve(feeDistributor.address, ethers.constants.MaxUint256);
            await feeDistributor.burn(amount);

            let nextTime = lastTokenTime.toNumber() + WEEK - 2000;
            await time.setNextBlockTimestamp(nextTime);
            await feeDistributor.checkpointToken();

            expect(await feeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await feeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await feeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount);
        });

        it("two checkpoint in a week", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await feeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.approve(feeDistributor.address, ethers.constants.MaxUint256);
            await feeDistributor.burn(amount);
            await feeDistributor.checkpointToken();
            expect(await feeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await feeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount);

            let nextTime = lastTokenTime.toNumber() + WEEK - 4000;
            await feeDistributor.burn(amount);
            await time.setNextBlockTimestamp(nextTime);
            await feeDistributor.checkpointToken();

            expect(await feeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await feeDistributor.tokenLastBalance()).to.equal(amount.add(amount));
            expect(await feeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount.add(amount));
        });

        it("just one week for checkpoint", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await feeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.approve(feeDistributor.address, ethers.constants.MaxUint256);
            await feeDistributor.burn(amount);

            let nextTime = lastTokenTime.toNumber() + WEEK;
            await time.setNextBlockTimestamp(nextTime);
            await feeDistributor.checkpointToken();

            expect(await feeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await feeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await feeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount);
        });

        it("one and half week for checkpoint", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await feeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(feeDistributor.address, amount);

            let nextTime = lastTokenTime.toNumber() + WEEK * 1.5;
            await time.setNextBlockTimestamp(nextTime);
            await feeDistributor.checkpointToken();

            expect(await feeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await feeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await feeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount.mul(2).div(3));
            expect(await feeDistributor.tokensPerWeek(lastTokenTime.toNumber() + WEEK)).to.equal(amount.mul(1).div(3));
            expect(await feeDistributor.tokensPerWeek(nextTime)).to.equal(0);
        });

        it("checkpoint ten week for checkpoint", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await feeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(feeDistributor.address, amount);

            let nextTime = lastTokenTime.toNumber() + WEEK * 10;
            await time.setNextBlockTimestamp(nextTime);
            await feeDistributor.checkpointToken();

            expect(await feeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await feeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await feeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount.mul(1).div(10));
            expect(await feeDistributor.tokensPerWeek(lastTokenTime.toNumber() + WEEK)).to.equal(amount.mul(1).div(10));
            expect(await feeDistributor.tokensPerWeek(nextTime - WEEK)).to.equal(amount.mul(1).div(10));
            expect(await feeDistributor.tokensPerWeek(nextTime)).to.equal(0);
        });

    })

    describe("checkpointTotalSupply", async function () {
        it("checkpoint a week for checkpoint", async function () {

            const { owner, alice, bob, feeDistributor, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            /// prepre veLT data
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            let value = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            let lockTime = await time.latest() + MAXTIME;
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);
            // let balanceVeLT = await veLT.balanceOf(owner.address);
            // console.log(balanceVeLT)
            // console.log(await veLT.epoch());
            // console.log(await veLT.totalSupply());

            let point = await veLT.supplyPointHistory(1);

            ///checkpointTotalSupply
            await time.setNextBlockTimestamp(await time.latest() + WEEK);
            await feeDistributor.checkpointTotalSupply();
            let afterTimeCursor = await feeDistributor.timeCursor();
            let supply = point.bias.sub(point.slope.mul(afterTimeCursor - WEEK - point.ts.toNumber()));
            expect(await feeDistributor.veSupply(afterTimeCursor - WEEK)).to.equal(supply);
        })

        it("checkpoint ten week for checkpoint", async function () {

            const { owner, alice, bob, feeDistributor, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            /// prepre veLT data
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            let value = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            let lockTime = await time.latest() + MAXTIME;
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let point = await veLT.supplyPointHistory(1);

            ///checkpointTotalSupply
            let timeCursor = await feeDistributor.timeCursor();
            await time.setNextBlockTimestamp(await time.latest() + WEEK * 10);
            await feeDistributor.checkpointTotalSupply();
            let afterTimeCursor = await feeDistributor.timeCursor();

            //first week cursor
            let supply = point.bias.sub(point.slope.mul(timeCursor.toNumber() + WEEK - point.ts.toNumber()));
            expect(await feeDistributor.veSupply(timeCursor.toNumber() + WEEK)).to.equal(supply);

            //next to last week cursor
            supply = point.bias.sub(point.slope.mul(afterTimeCursor - WEEK * 2 - point.ts.toNumber()));
            expect(await feeDistributor.veSupply(afterTimeCursor - WEEK * 2)).to.equal(supply);

            //the last week cursor
            supply = point.bias.sub(point.slope.mul(afterTimeCursor - WEEK - point.ts.toNumber()));
            expect(await feeDistributor.veSupply(afterTimeCursor - WEEK)).to.equal(supply);
        })

    })

    describe("veForAt && vePrecentageForAt", async function () {

        it("veForAt is zero ", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, stakingHope, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            /// prepre veLT data
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            let value = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            let lockTime = await time.latest() + 10 * WEEK;
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let timestamp = await time.latest() + 12 * WEEK;
            let veFor = await feeDistributor.veForAt(owner.address, timestamp);
            expect(veFor).to.be.equal(0);
        })

        it("veForAt", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, stakingHope, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            /// prepre veLT data
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            let value = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            let lockTime = await time.latest() + MAXTIME;
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);
            await veLT.createLockFor(alice.address, value, lockTime, NONCE1, DEADLINE, sig1);

            let timestamp = await time.latest() + WEEK;
            let veFor = await feeDistributor.veForAt(owner.address, timestamp);
            let point = await veLT.userPointHistory(owner.address, 1);
            expect(veFor).to.equal(point.bias.sub(point.slope.mul(timestamp - point.ts.toNumber())));

            let veFor1 = await feeDistributor.veForAt(alice.address, timestamp);
            let point1 = await veLT.userPointHistory(alice.address, 1);
            expect(veFor1).to.equal(point1.bias.sub(point1.slope.mul(timestamp - point1.ts.toNumber())));
        })

        it("vePrecentageForAt", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, stakingHope, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            /// prepre veLT data for owner
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            let value = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            let lockTime = await time.latest() + MAXTIME;
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);
            /// prepre veLT data for alice
            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);
            await veLT.createLockFor(alice.address, value, lockTime, NONCE1, DEADLINE, sig1);

            await time.increase(WEEK);
            await feeDistributor.checkpointTotalSupply();

            let timestamp = await time.latest();
            let precentage1 = await feeDistributor.vePrecentageForAt(owner.address, timestamp);
            let precentage2 = await feeDistributor.vePrecentageForAt(alice.address, timestamp);
            expect(precentage1).to.be.equal(ethers.utils.parseEther("0.5"));
            expect(precentage2).to.be.equal(ethers.utils.parseEther("0.5"));
        })

    })

    describe("claim", async function () {

        it("should revert right error when call claim if contract pause", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await feeDistributor.pause();
            await expect(feeDistributor.claim(owner.address)).to.rejectedWith("Pausable: paused");
        })

        it("should revert right error when call claimMany if contract pause", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await feeDistributor.pause();
            await expect(feeDistributor.claimMany([owner.address, alice.address])).to.rejectedWith("Pausable: paused");
        })

        it("claim nothing if no veLT", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            /// prepre veLT data
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            let value = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            let lockTime = await time.latest() + MAXTIME;
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            ///transfer hope to feeDistributor
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(feeDistributor.address, amount);

            ///increse ten week
            await time.setNextBlockTimestamp(await time.latest() + WEEK * 10);
            let timeCursor = await feeDistributor.timeCursor();
            let firstTimeCursor = timeCursor + WEEK;
            await feeDistributor.toggleAllowCheckpointToken();

            /// alice claim nothing
            await feeDistributor.claim(alice.address);
            expect(await feeDistributor.tokenLastBalance()).to.equal(amount);
        })

        it("claim success just one person", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, stakingHope, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            /// prepre veLT data
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            let value = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            let lockTime = await time.latest() + MAXTIME;
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            await time.increase(WEEK);
            await feeDistributor.checkpointToken();
            let lastTokenTime = await feeDistributor.lastTokenTime();

            ///transfer hope to feeDistributor
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(feeDistributor.address, amount);

            await time.increase(WEEK);
            await feeDistributor.checkpointToken();
            await feeDistributor.checkpointTotalSupply();
            await feeDistributor.toggleAllowCheckpointToken();

            let tt = lastTokenTime.toNumber() - lastTokenTime.toNumber() % WEEK;
            let preWeekBalance = await feeDistributor.tokensPerWeek(tt);
            let preWeekBalance1 = await feeDistributor.tokensPerWeek(tt + WEEK);
            // console.log("lastTokenTime:", lastTokenTime);

            /// claim  fee
            await time.increase(WEEK);
            await feeDistributor.claim(ethers.constants.AddressZero);
            let tokenLastBalance = await feeDistributor.tokenLastBalance();
            expect(tokenLastBalance.toNumber() < 10).to.be.true;
            expect(await stakingHope.balanceOf(owner.address)).to.equal(preWeekBalance.add(preWeekBalance1));
        })

        it("claimMany success", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, stakingHope, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            /// prepre veLT data
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            let value = ethers.utils.parseEther("1000");
            const sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            let lockTime = await time.latest() + MAXTIME;
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);

            let NONCE1 = BigNumber.from(ethers.utils.randomBytes(32));
            const sig1 = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE1, DEADLINE);
            await veLT.createLockFor(alice.address, value, lockTime, NONCE1, DEADLINE, sig1);

            await time.increase(WEEK);
            await feeDistributor.checkpointToken();
            let lastTokenTime = await feeDistributor.lastTokenTime();
            ///transfer hope to feeDistributor
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(feeDistributor.address, amount);

            ///increse ten week
            await time.increase(WEEK * 10);
            await feeDistributor.checkpointToken();
            await feeDistributor.checkpointTotalSupply();
            await feeDistributor.toggleAllowCheckpointToken();

            let tt = lastTokenTime.toNumber() - lastTokenTime.toNumber() % WEEK;
            let totalBalance = BigNumber.from("0");
            for (let index = 0; index <= 10; index++) {
                let preWeekBalance = await feeDistributor.tokensPerWeek(tt + WEEK * index);
                // console.log("preWeekBalance", preWeekBalance);
                totalBalance = totalBalance.add(preWeekBalance);
            }

            /// claim fee
            await time.increase(WEEK);
            await feeDistributor.claimMany([owner.address, alice.address]);
            let balance = await stakingHope.balanceOf(owner.address);
            let balance1 = await stakingHope.balanceOf(alice.address);
            // console.log(balance, balance1);
            let tokenLastBalance = await feeDistributor.tokenLastBalance();
            expect(tokenLastBalance.toNumber() < 50).to.be.true;
            expect(balance.add(balance1).sub(totalBalance).toNumber() < 100).to.be.true;
        })
    })

    describe("recoverBalance", async function () {

        it("should revert right error when call recoverBalance if caller is not owner", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await expect(feeDistributor.connect(alice).recoverBalance()).to.rejectedWith("Ownable: caller is not the owner");
        })

        it("recoverBalance success", async function () {
            const { owner, alice, bob, feeDistributor, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await hopeToken.transfer(feeDistributor.address, ethers.utils.parseEther("100"));

            await feeDistributor.setEmergencyReturn(alice.address);
            let balance = await hopeToken.balanceOf(feeDistributor.address);
            await feeDistributor.recoverBalance();
            expect(await hopeToken.balanceOf(alice.address)).to.be.equal(balance);
            expect(await hopeToken.balanceOf(feeDistributor.address)).to.be.equal(0);

        })
    })

})