import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { PermitSigHelper } from "./PermitSigHelper";
import { BigNumber } from "ethers";

describe("GaugeFeeDistributor", function () {

    /// We define a fixture to reuse the same setup in every test.
    /// We use loadFixture to run this setup once, snapshot that state,
    /// and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, alice, bob] = await ethers.getSigners();

        let LT = await ethers.getContractFactory("LT");
        const VeLT = await ethers.getContractFactory("VotingEscrow");
        const GaugeController = await ethers.getContractFactory("GaugeController");
        const Minter = await ethers.getContractFactory("Minter");
        const StakingHOPE = await ethers.getContractFactory("StakingHOPE");
        const HOPE = await ethers.getContractFactory("HOPE");
        const RestrictedList = await ethers.getContractFactory("RestrictedList");
        const Admin = await ethers.getContractFactory("Admin");
        const GaugeFeeDistributor = await ethers.getContractFactory("GaugeFeeDistributor");

        ///deploy permit contract
        const Permit2Contract = await ethers.getContractFactory("Permit2");
        const permit2 = await Permit2Contract.deploy();

        ///deploy LT contract
        const lt = await upgrades.deployProxy(LT, ['LT Dao Token', 'LT']);
        await lt.deployed();
        await time.increase(2 * 86400);
        await lt.updateMiningParameters();
        await lt.approve(permit2.address, ethers.constants.MaxUint256);

        ///deploy VeLT contract
        const veLT = await VeLT.deploy(lt.address, permit2.address);
        await veLT.deployed();

        ///deploy gaugeController contract
        const gaugeController = await GaugeController.deploy(lt.address, veLT.address);
        await gaugeController.deployed();

        ///delopy minter contract
        const minter = await Minter.deploy(lt.address, gaugeController.address);
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
        let MINT_AMOUNT = ethers.utils.parseEther("100000");
        const effectiveBlock = await ethers.provider.getBlockNumber();
        const expirationBlock = effectiveBlock + 1000;
        await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);
        await admin.mint(bob.address, ethers.utils.parseEther("50000"));
        await admin.mint(owner.address, ethers.utils.parseEther("50000"));

        ///deploy stakingHOPE contract
        const stakingHope = await StakingHOPE.deploy(hopeToken.address, minter.address, permit2.address);
        await stakingHope.deployed();

        //deploy feeDistributor contract
        let startTime = await time.latest();
        const gaugeFeeDistributor = await upgrades.deployProxy(GaugeFeeDistributor, [gaugeController.address, startTime, hopeToken.address, stakingHope.address, bob.address]);
        await gaugeFeeDistributor.deployed();

        ///add gauge to gaugeController
        let name = "Staking HOPE Type";
        let weight = ethers.utils.parseEther("1");
        let typeId = await gaugeController.nGaugeTypes();
        await gaugeController.addType(name, weight);
        const MockGauge = await ethers.getContractFactory("MockGauge");
        const mockGauge = await MockGauge.deploy();
        await mockGauge.deployed();
        const MockGaugeV2 = await ethers.getContractFactory("MockGaugeV2");
        const mockGaugeV2 = await MockGaugeV2.deploy();
        await mockGaugeV2.deployed();

        await gaugeController.addGauge(stakingHope.address, typeId, ethers.utils.parseEther("0"));
        await gaugeController.addGauge(mockGauge.address, typeId, ethers.utils.parseEther("0"));
        await gaugeController.addGauge(mockGaugeV2.address, typeId, ethers.utils.parseEther("1"));

        const WEEK = 7 * 86400;
        const MAXTIME = 4 * 365 * 86400;

        return { owner, alice, bob, hopeToken, stakingHope, lt, veLT, permit2, gaugeFeeDistributor, gaugeController, mockGauge, mockGaugeV2, WEEK, MAXTIME }
    }


    describe("checkpointToken", async function () {

        it("should revert right error when checkpoint by caller is not owner", async function () {
            const { owner, alice, bob, gaugeFeeDistributor } = await loadFixture(deployOneYearLockFixture);

            await expect(gaugeFeeDistributor.connect(alice).checkpointToken()).to.revertedWith("FD001");
        });

        it("should revert right error when checkpoint too often", async function () {
            const { owner, alice, bob, gaugeFeeDistributor } = await loadFixture(deployOneYearLockFixture);

            await gaugeFeeDistributor.checkpointToken();
            await gaugeFeeDistributor.toggleAllowCheckpointToken();
            await expect(gaugeFeeDistributor.connect(alice).checkpointToken()).to.revertedWith("FD001");
        });

        it("less than one week for checkpoint", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await gaugeFeeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.approve(gaugeFeeDistributor.address, ethers.constants.MaxUint256);
            await gaugeFeeDistributor.burn(amount);

            let nextTime = lastTokenTime.toNumber() + WEEK - 2000;
            await time.setNextBlockTimestamp(nextTime);
            await gaugeFeeDistributor.checkpointToken();

            expect(await gaugeFeeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await gaugeFeeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await gaugeFeeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount);
        });

        it("twice checkpoint in a week", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await gaugeFeeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.approve(gaugeFeeDistributor.address, ethers.constants.MaxUint256);
            await gaugeFeeDistributor.burn(amount);
            await gaugeFeeDistributor.checkpointToken();
            expect(await gaugeFeeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await gaugeFeeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount);

            let nextTime = lastTokenTime.toNumber() + WEEK - 4000;
            await hopeToken.transfer(gaugeFeeDistributor.address, amount);
            await time.setNextBlockTimestamp(nextTime);
            await gaugeFeeDistributor.checkpointToken();

            expect(await gaugeFeeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await gaugeFeeDistributor.tokenLastBalance()).to.equal(amount.add(amount));
            expect(await gaugeFeeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount.add(amount));
        });

        it("just one week for checkpoint", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await gaugeFeeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.approve(gaugeFeeDistributor.address, ethers.constants.MaxUint256);
            await gaugeFeeDistributor.burn(amount);

            let nextTime = lastTokenTime.toNumber() + WEEK;
            await time.setNextBlockTimestamp(nextTime);
            await gaugeFeeDistributor.checkpointToken();

            expect(await gaugeFeeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await gaugeFeeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await gaugeFeeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount);
        });

        it("one and half week for checkpoint", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await gaugeFeeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.approve(gaugeFeeDistributor.address, ethers.constants.MaxUint256);
            await gaugeFeeDistributor.burn(amount);

            let nextTime = lastTokenTime.toNumber() + WEEK * 1.5;
            await time.setNextBlockTimestamp(nextTime);
            await gaugeFeeDistributor.checkpointToken();

            expect(await gaugeFeeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await gaugeFeeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await gaugeFeeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount.mul(2).div(3));
            expect(await gaugeFeeDistributor.tokensPerWeek(lastTokenTime.toNumber() + WEEK)).to.equal(amount.mul(1).div(3));
            expect(await gaugeFeeDistributor.tokensPerWeek(nextTime)).to.equal(0);
        });

        it("checkpoint ten week for checkpoint", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, WEEK } = await loadFixture(deployOneYearLockFixture);

            let lastTokenTime = await gaugeFeeDistributor.lastTokenTime();
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(gaugeFeeDistributor.address, amount);

            let nextTime = lastTokenTime.toNumber() + WEEK * 10;
            await time.setNextBlockTimestamp(nextTime);
            await gaugeFeeDistributor.checkpointToken();

            expect(await gaugeFeeDistributor.lastTokenTime()).to.equal(nextTime);
            expect(await gaugeFeeDistributor.tokenLastBalance()).to.equal(amount);
            expect(await gaugeFeeDistributor.tokensPerWeek(lastTokenTime)).to.equal(amount.mul(1).div(10));
            expect(await gaugeFeeDistributor.tokensPerWeek(lastTokenTime.toNumber() + WEEK)).to.equal(amount.mul(1).div(10));
            expect(await gaugeFeeDistributor.tokensPerWeek(nextTime - WEEK)).to.equal(amount.mul(1).div(10));
            expect(await gaugeFeeDistributor.tokensPerWeek(nextTime)).to.equal(0);
        });

    })

    describe("veForAt && vePrecentageForAt && gaugeBalancePreWeek", async function () {

        it("veForAt is zero", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, stakingHope, gaugeController, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            /// prepre veLT data for owner
            const DEADLINE = await time.latest() + 60 * 60 * 24 * 365;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            let value = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, lt.address, permit2.address, veLT.address, value, NONCE, DEADLINE);
            let lockTime = await time.latest() + 10 * WEEK;
            await veLT.createLock(value, lockTime, NONCE, DEADLINE, sig);
            ///voting stakingHope gauge
            await gaugeController.voteForGaugeWeights(stakingHope.address, 5000);

            let timestamp = await time.latest() + 15 * WEEK;
            let veFor = await gaugeFeeDistributor.veForAt(stakingHope.address, owner.address, timestamp);
            expect(veFor).to.equal(0);
        })

        it("veForAt", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, stakingHope, gaugeController, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

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
            ///voting stakingHope gauge
            await gaugeController.voteForGaugeWeights(stakingHope.address, 5000);
            await gaugeController.connect(alice).voteForGaugeWeights(stakingHope.address, 5000);

            let timestamp = await time.latest() + WEEK;
            let veFor = await gaugeFeeDistributor.veForAt(stakingHope.address, owner.address, timestamp);
            let point = await gaugeController.voteVeLtPointHistory(owner.address, stakingHope.address, 1);
            expect(veFor).to.equal(point.bias.sub(point.slope.mul(timestamp - point.ts.toNumber())));

            let veFor1 = await gaugeFeeDistributor.veForAt(stakingHope.address, alice.address, timestamp);
            let point1 = await gaugeController.voteVeLtPointHistory(alice.address, stakingHope.address, 1);
            expect(veFor1).to.equal(point1.bias.sub(point1.slope.mul(timestamp - point1.ts.toNumber())));
        })

        it("vePrecentageForAt", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, stakingHope, gaugeController, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

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
            ///voting stakingHope gauge
            await gaugeController.voteForGaugeWeights(stakingHope.address, 5000);
            await gaugeController.connect(alice).voteForGaugeWeights(stakingHope.address, 5000);

            let timestamp = await time.latest() + WEEK;
            let precentage1 = await gaugeFeeDistributor.callStatic.vePrecentageForAt(stakingHope.address, owner.address, timestamp);
            let precentage2 = await gaugeFeeDistributor.callStatic.vePrecentageForAt(stakingHope.address, alice.address, timestamp);
            expect(precentage1).to.be.equal(ethers.utils.parseEther("0.5"));
            expect(precentage2).to.be.equal(ethers.utils.parseEther("0.5"));
        })

        it("gaugeBalancePreWeek", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, stakingHope, gaugeController, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

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
            ///voting stakingHope gauge
            await gaugeController.voteForGaugeWeights(stakingHope.address, 5000);
            await gaugeController.connect(alice).voteForGaugeWeights(stakingHope.address, 5000);

            await time.increase(WEEK);
            await gaugeFeeDistributor.checkpointToken();
            let lastTokenTime = await gaugeFeeDistributor.lastTokenTime();

            //transfer hope fee and checkpoint
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(gaugeFeeDistributor.address, amount);
            await gaugeFeeDistributor.checkpointToken();
            await gaugeController.checkpointGauge(stakingHope.address);

            /// check gaugeBalancePreWeek
            let relativeWeight = await gaugeController.gaugeRelativeWeight(stakingHope.address, lastTokenTime);
            let gaugeBalance = await gaugeFeeDistributor.gaugeBalancePreWeek(stakingHope.address, lastTokenTime);
            let timeCursor = lastTokenTime - lastTokenTime % WEEK;
            let tokensPerWeek = await gaugeFeeDistributor.tokensPerWeek(timeCursor)
            expect(gaugeBalance).to.be.equal(tokensPerWeek.mul(relativeWeight).div(ethers.utils.parseEther("1")));
        })
    })

    describe("claim", async function () {

        it("should revert right error when call claim if contract pause", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, stakingHope, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await gaugeFeeDistributor.pause();
            await expect(gaugeFeeDistributor.claim(stakingHope.address, owner.address)).to.rejectedWith("Pausable: paused");
        })

        it("should revert right error when call claimMany if contract pause", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, stakingHope, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await gaugeFeeDistributor.pause();
            await expect(gaugeFeeDistributor.claimMany(stakingHope.address, [owner.address, alice.address])).to.rejectedWith("Pausable: paused");
        })

        it("claim success", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, stakingHope, gaugeController, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

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
            ///voting stakingHope gauge
            await gaugeController.voteForGaugeWeights(stakingHope.address, 5000);
            await gaugeController.connect(alice).voteForGaugeWeights(stakingHope.address, 5000);

            await time.increase(WEEK);
            await gaugeFeeDistributor.checkpointToken();
            let lastTokenTime = await gaugeFeeDistributor.lastTokenTime();

            ///transfer hope fee and checkpoint
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(gaugeFeeDistributor.address, amount);
            await gaugeFeeDistributor.checkpointToken();
            await gaugeController.checkpointGauge(stakingHope.address);

            await time.increase(WEEK);
            await gaugeFeeDistributor.checkpointToken();

            /// ownerClaimBalance =  gaugeBalancePreWeek * ownerVotingGaugePrecentage
            let gaugeBalance = await gaugeFeeDistributor.gaugeBalancePreWeek(stakingHope.address, lastTokenTime);
            let ownerVotingGaugePrecentage = await gaugeFeeDistributor.callStatic.vePrecentageForAt(stakingHope.address, owner.address, lastTokenTime);
            await gaugeFeeDistributor.claim(stakingHope.address, owner.address);
            let expectStHOPE = gaugeBalance.mul(ownerVotingGaugePrecentage).div(ethers.utils.parseEther("1"));
            expect(await stakingHope.balanceOf(owner.address)).to.be.equal(expectStHOPE);
        })

        it("claimMany success", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, stakingHope, gaugeController, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

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
            ///voting stakingHope gauge
            await gaugeController.voteForGaugeWeights(stakingHope.address, 5000);
            await gaugeController.connect(alice).voteForGaugeWeights(stakingHope.address, 5000);

            await time.increase(WEEK);
            await gaugeFeeDistributor.checkpointToken();
            let lastTokenTime = await gaugeFeeDistributor.lastTokenTime();

            ///transfer hope fee and checkpoint
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(gaugeFeeDistributor.address, amount);
            await gaugeFeeDistributor.checkpointToken();
            await gaugeController.checkpointGauge(stakingHope.address);

            await time.increase(WEEK);
            await gaugeFeeDistributor.checkpointToken();

            /// ownerClaimBalance =  gaugeBalancePreWeek * ownerVotingGaugePrecentage
            let gaugeBalance = await gaugeFeeDistributor.gaugeBalancePreWeek(stakingHope.address, lastTokenTime);
            let ownerVotingGaugePrecentage = await gaugeFeeDistributor.callStatic.vePrecentageForAt(stakingHope.address, owner.address, lastTokenTime);
            let aliceVotingGaugePrecentage = await gaugeFeeDistributor.callStatic.vePrecentageForAt(stakingHope.address, alice.address, lastTokenTime);
            await gaugeFeeDistributor.claimMany(stakingHope.address, [owner.address, alice.address]);
            let expectStHOPE = gaugeBalance.mul(ownerVotingGaugePrecentage).div(ethers.utils.parseEther("1"));
            expect(await stakingHope.balanceOf(owner.address)).to.be.equal(expectStHOPE);
            let expectStHOPE1 = gaugeBalance.mul(aliceVotingGaugePrecentage).div(ethers.utils.parseEther("1"));
            expect(await stakingHope.balanceOf(alice.address)).to.be.equal(expectStHOPE1);
        })

        it("claimManyGauge success", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, stakingHope, gaugeController, WEEK, veLT, lt, permit2, MAXTIME, mockGauge } = await loadFixture(deployOneYearLockFixture);

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
            ///voting  gauge
            await gaugeController.voteForGaugeWeights(stakingHope.address, 5000);
            await gaugeController.voteForGaugeWeights(mockGauge.address, 5000);
            await gaugeController.connect(alice).voteForGaugeWeights(mockGauge.address, 5000);

            await time.increase(WEEK);
            await gaugeFeeDistributor.checkpointToken();
            let lastTokenTime = await gaugeFeeDistributor.lastTokenTime();

            ///transfer hope fee and checkpoint
            let amount = ethers.utils.parseEther("1000");
            await hopeToken.transfer(gaugeFeeDistributor.address, amount);
            await gaugeFeeDistributor.checkpointToken();
            await gaugeController.checkpointGauge(stakingHope.address);

            await time.increase(WEEK);
            await gaugeFeeDistributor.checkpointToken();

            /// ownerClaimBalance =  allStakingGaugeBalance + mockGaugeBalance/2
            let gaugeBalance1 = await gaugeFeeDistributor.gaugeBalancePreWeek(stakingHope.address, lastTokenTime);
            let gaugeBalance2 = await gaugeFeeDistributor.gaugeBalancePreWeek(mockGauge.address, lastTokenTime);
            await gaugeFeeDistributor.claimManyGauge([stakingHope.address, mockGauge.address], owner.address, { gasLimit: 30000000 });
            let ownerVotingGaugePrecentage = await gaugeFeeDistributor.callStatic.vePrecentageForAt(mockGauge.address, owner.address, lastTokenTime);
            let expectStHOPE = gaugeBalance1.add(gaugeBalance2.mul(ownerVotingGaugePrecentage).div(ethers.utils.parseEther("1")));
            expect(await stakingHope.balanceOf(owner.address)).to.be.equal(expectStHOPE);
        })
    })

    describe("recoverBalance", async function () {

        it("should revert right error when call recoverBalance if caller is not owner", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await expect(gaugeFeeDistributor.connect(alice).recoverBalance()).to.rejectedWith("Ownable: caller is not the owner");
        })

        it("recoverBalance success", async function () {
            const { owner, alice, bob, gaugeFeeDistributor, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            await hopeToken.transfer(gaugeFeeDistributor.address, ethers.utils.parseEther("100"));
            let balance = await hopeToken.balanceOf(gaugeFeeDistributor.address);
            await gaugeFeeDistributor.setEmergencyReturn(alice.address);
            await gaugeFeeDistributor.recoverBalance();
            expect(await hopeToken.balanceOf(alice.address)).to.be.equal(balance);
            expect(await hopeToken.balanceOf(gaugeFeeDistributor.address)).to.be.equal(0);

        })
    })

})