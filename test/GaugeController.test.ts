import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PermitSigHelper } from "./PermitSigHelper";
import { BigNumber } from "ethers";


describe("GaugeController", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount, thridAccount] = await ethers.getSigners();

        let MyERC20LT = await ethers.getContractFactory("LT");
        const eRC20LT = await upgrades.deployProxy(MyERC20LT, ['LT Dao Token', 'LT']);
        await eRC20LT.deployed();
        await time.increase(2 * 86400);
        await eRC20LT.updateMiningParameters();

        const Permit2Contract = await ethers.getContractFactory("Permit2");
        const permit2 = await Permit2Contract.deploy();
        // console.log("Permit2 contract address: ", permit2.address);

        await eRC20LT.approve(permit2.address, ethers.constants.MaxUint256);

        const VeLT = await ethers.getContractFactory("VotingEscrow");
        const veLT = await VeLT.deploy(eRC20LT.address, permit2.address);
        await veLT.deployed();

        //lock lt
        const WEEK = 7 * 86400;
        const MAXTIME = 4 * 365 * 86400;
        let ti = await time.latest();
        let lockTime = ti + MAXTIME;
        const DEADLINE = await time.latest() + 60 * 60;
        let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
        let lockLTAmount = ethers.utils.parseEther("100000");
        const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, lockLTAmount, NONCE, DEADLINE);
        await veLT.createLock(lockLTAmount, lockTime, NONCE, DEADLINE, sig);

        const GaugeController = await ethers.getContractFactory("GaugeController");
        const gaugeController = await GaugeController.deploy(eRC20LT.address, veLT.address);
        await gaugeController.deployed();

        const MockGauge = await ethers.getContractFactory("MockGauge");
        const mockGauge = await MockGauge.deploy();
        await mockGauge.deployed();

        const MockGaugeV2 = await ethers.getContractFactory("MockGaugeV2");
        const mockGaugeV2 = await MockGaugeV2.deploy();
        await mockGaugeV2.deployed();

        return { eRC20LT, gaugeController, mockGauge, mockGaugeV2, veLT, permit2, owner, otherAccount, thridAccount, WEEK, MAXTIME };
    }

    async function preprareGauge() {
        const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, WEEK } = await loadFixture(deployOneYearLockFixture);

        //prepare data
        let name = "LT Staking Type";
        let weight = ethers.utils.parseEther("1");
        let typeId = await gaugeController.nGaugeTypes();
        await gaugeController.addType(name, weight);
        let gaugeWeight = ethers.utils.parseEther("1");
        await gaugeController.addGauge(mockGauge.address, typeId, gaugeWeight);
        await gaugeController.addGauge(mockGaugeV2.address, typeId, gaugeWeight);

        return { typeId, weight, gaugeWeight };
    }


    describe("GaugeController Type Manage", async function () {

        it("addType", async function () {

            const { gaugeController, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await expect(await gaugeController.addType(name, weight)).to.emit(gaugeController, 'AddType').withArgs(name, typeId);

            expect(await gaugeController.nGaugeTypes()).to.equal(typeId.add(1));
            expect(await gaugeController.gaugeTypeNames(typeId)).to.equal(name);
            expect(await gaugeController.getTypeWeight(typeId)).to.equal(weight);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(0);
            expect(await gaugeController.getTotalWeight()).to.equal(0);
        });

        it("addType twice", async function () {

            const { gaugeController, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await expect(await gaugeController.addType(name, weight)).to.emit(gaugeController, 'AddType').withArgs(name, typeId);
            expect(await gaugeController.nGaugeTypes()).to.equal(typeId.add(1));
            expect(await gaugeController.gaugeTypeNames(typeId)).to.equal(name);
            expect(await gaugeController.getTypeWeight(typeId)).to.equal(weight);


            let typeId1 = await gaugeController.nGaugeTypes();
            let name1 = "LT SWAP POOL1";
            await expect(await gaugeController.addType(name1, weight)).to.emit(gaugeController, 'AddType').withArgs(name1, typeId1);
            expect(await gaugeController.nGaugeTypes()).to.equal(typeId1.add(1));
            expect(await gaugeController.getTypeWeight(typeId1)).to.equal(weight);
            expect(await gaugeController.gaugeTypeNames(typeId1)).to.equal(name1);

            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(0);
            expect(await gaugeController.getTotalWeight()).to.equal(0);
        });

        it("changeTypeWeight when no veLT vote", async function () {

            const { gaugeController, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);

            //test
            let weight2 = ethers.utils.parseEther("2");
            await gaugeController.changeTypeWeight(typeId, weight2);
            expect(await gaugeController.getTypeWeight(typeId)).to.equal(weight2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(0);
            expect(await gaugeController.getTotalWeight()).to.equal(0);
        });


        it("changeTypeWeight when has veLT vote", async function () {

            const { gaugeController, mockGauge, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            await gaugeController.addGauge(mockGauge.address, typeId, weight);


            //test
            let weight2 = ethers.utils.parseEther("2");
            await gaugeController.changeTypeWeight(typeId, weight2);
            expect(await gaugeController.getTypeWeight(typeId)).to.equal(weight2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(weight);
            expect(await gaugeController.getTotalWeight()).to.equal(weight2.mul(weight));
        });
    })

    describe("GaugeController Gauge Manage", async function () {

        it("should revert right error when typeId is invalid", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await expect(gaugeController.addGauge(mockGauge.address, 0, 0)).to.revertedWith("GC001");
        });

        it("should revert right error when add gauge twice", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            gaugeController.addGauge(mockGauge.address, typeId, 0);

            //test
            await expect(gaugeController.addGauge(mockGauge.address, typeId, 0)).to.revertedWith("GC002");
        });


        it("addGauge with zero weight", async function () {

            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);

            //test
            await expect(await gaugeController.addGauge(mockGauge.address, typeId, 0)).to.emit(gaugeController, "NewGauge").withArgs(mockGauge.address, typeId, 0);
            expect(await gaugeController.gaugeTypes(mockGauge.address)).to.equal(typeId);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(0);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(0);
            expect(await gaugeController.getTotalWeight()).to.equal(0);
        });

        it("addGauge with weight", async function () {

            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, WEEK } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);

            //test
            let gaugeWeight = ethers.utils.parseEther("1");
            await expect(await gaugeController.addGauge(mockGauge.address, typeId, gaugeWeight)).to.emit(gaugeController, "NewGauge").withArgs(mockGauge.address, typeId, gaugeWeight);
            expect(await gaugeController.gaugeTypes(mockGauge.address)).to.equal(typeId);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(gaugeWeight);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(gaugeWeight);
            expect(await gaugeController.getTotalWeight()).to.equal(gaugeWeight.mul(weight));

            //addGauge Weight will not decrease over time
            await time.increase(WEEK * 10);
            await gaugeController.checkpointGauge(mockGauge.address);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(gaugeWeight);
            expect(await gaugeController.getTotalWeight()).to.equal(gaugeWeight.mul(weight));
        });

        it("addGauge with two gauge", async function () {

            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, WEEK } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);

            //test
            let gaugeWeight = ethers.utils.parseEther("1");
            await expect(await gaugeController.addGauge(mockGauge.address, typeId, gaugeWeight)).to.emit(gaugeController, "NewGauge").withArgs(mockGauge.address, typeId, gaugeWeight);
            expect(await gaugeController.gaugeTypes(mockGauge.address)).to.equal(typeId);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(gaugeWeight);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(gaugeWeight);
            expect(await gaugeController.getTotalWeight()).to.equal(gaugeWeight.mul(weight));

            let gaugeWeight1 = ethers.utils.parseEther("2");
            await expect(await gaugeController.addGauge(mockGaugeV2.address, typeId, gaugeWeight1)).to.emit(gaugeController, "NewGauge").withArgs(mockGaugeV2.address, typeId, gaugeWeight1);
            expect(await gaugeController.gaugeTypes(mockGaugeV2.address)).to.equal(typeId);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(gaugeWeight.add(gaugeWeight1));
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(gaugeWeight1);
            expect(await gaugeController.getTotalWeight()).to.equal((gaugeWeight.add(gaugeWeight1)).mul(weight));

            let lastTime = await time.latest();
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, lastTime)).to.equal(BigNumber.from("0"));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, lastTime + WEEK)).to.equal(BigNumber.from("666666666666666666"));
        });

        it("should revert right error when gauge not addd", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await expect(gaugeController.changeGaugeWeight(mockGauge.address, 0)).to.revertedWith("GC000");
        });

        it("changeGaugeWeight", async function () {

            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, WEEK } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            await preprareGauge();
            let typeId = 0;
            let weight = ethers.utils.parseEther("1");

            let gaugeWeight = ethers.utils.parseEther("1");
            //test
            let gaugeWeight1 = ethers.utils.parseEther("2");
            await expect(await gaugeController.changeGaugeWeight(mockGauge.address, gaugeWeight1)).to.emit(gaugeController, "NewGaugeWeight").withArgs(mockGauge.address, anyValue, gaugeWeight1, (gaugeWeight1.add(gaugeWeight)).mul(weight));
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(gaugeWeight1.add(gaugeWeight));
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(gaugeWeight1);
            expect(await gaugeController.getTotalWeight()).to.equal(gaugeWeight1.add(gaugeWeight).mul(weight));

            await expect(await gaugeController.changeGaugeWeight(mockGaugeV2.address, gaugeWeight1)).to.emit(gaugeController, "NewGaugeWeight").withArgs(mockGaugeV2.address, anyValue, gaugeWeight1, gaugeWeight1.mul(2).mul(weight));
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(gaugeWeight1.add(gaugeWeight1));
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(gaugeWeight1);
            expect(await gaugeController.getTotalWeight()).to.equal((gaugeWeight1.add(gaugeWeight1)).mul(weight));

            let lastTime = await time.latest();
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, lastTime)).to.equal(BigNumber.from("0"));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, lastTime + WEEK)).to.equal(BigNumber.from("500000000000000000"));
        });
    })

    describe("voteForGaugeWeights", async function () {

        it("should revert right error when Gauge not added", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            let userWeight = 10001;
            await expect(gaugeController.voteForGaugeWeights(mockGauge.address, userWeight)).to.revertedWith("GC000");
        });

        it("should revert right error when veLT Lock expire", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            await preprareGauge();

            let userWeight = 1000;
            await expect(gaugeController.connect(otherAccount).voteForGaugeWeights(mockGauge.address, userWeight)).to.revertedWith("GC003");
        });

        it("should revert right error when userWeight greater than 100%", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            await preprareGauge();

            let userWeight = 10001;
            await expect(gaugeController.voteForGaugeWeights(mockGauge.address, userWeight)).to.revertedWith("GC004");
        });

        it("should revert right error when vote so often", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            await preprareGauge();
            let userWeight = 10000;
            gaugeController.voteForGaugeWeights(mockGauge.address, userWeight);

            await expect(gaugeController.voteForGaugeWeights(mockGauge.address, userWeight)).to.revertedWith("GC005");
        });

        it("voteForGaugeWeights ", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, veLT } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            await preprareGauge();
            let userWeight = 10000;
            gaugeController.voteForGaugeWeights(mockGauge.address, userWeight);
            gaugeController.voteForGaugeWeights(mockGaugeV2.address, userWeight)

            let WEIGHT_VOTE_DELAY = 10 * 86400;
            await time.increase(WEIGHT_VOTE_DELAY);
            gaugeController.voteForGaugeWeights(mockGauge.address, userWeight / 10);
            gaugeController.voteForGaugeWeights(mockGaugeV2.address, userWeight / 10)
        });


        it("voteForGaugeWeights one gauge", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            let gaugeWeight = ethers.utils.parseEther("1");
            await gaugeController.addGauge(mockGauge.address, typeId, gaugeWeight);
            let userWeight = 10000;
            let lastTime = await time.latest();

            await expect(await gaugeController.voteForGaugeWeights(mockGauge.address, userWeight)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGauge.address, anyValue, userWeight);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let Wg = slope.mul((lockEnd.toNumber() - nextTime));
            Wg = Wg.add(gaugeWeight);
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, lastTime + WEEK)).to.equal(BigNumber.from("1000000000000000000"));
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getTotalWeight()).to.equal(Wg.mul(weight));
        });


        it("voteForGaugeWeights with over time", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            let gaugeWeight = ethers.utils.parseEther("1");
            await gaugeController.addGauge(mockGauge.address, typeId, gaugeWeight);
            let userWeight = 10000;
            let lastTime = await time.latest();

            await expect(await gaugeController.voteForGaugeWeights(mockGauge.address, userWeight)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGauge.address, anyValue, userWeight);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let Wg = slope.mul((lockEnd.toNumber() - nextTime));
            Wg = Wg.add(gaugeWeight);
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, lastTime + WEEK)).to.equal(ethers.utils.parseEther("1"));
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getTotalWeight()).to.equal(Wg.mul(weight));


            await time.setNextBlockTimestamp(nextTime);
            await gaugeController.checkpoint();
            let afterWg = Wg.sub(slope.mul(WEEK));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, lastTime + WEEK)).to.equal(ethers.utils.parseEther("1"));
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(afterWg);
            expect(await gaugeController.getTotalWeight()).to.equal(afterWg.mul(weight));


            await time.setNextBlockTimestamp(nextTime + WEEK);
            await gaugeController.checkpointGauge(mockGauge.address);
            let afterWg1 = Wg.sub(slope.mul(WEEK * 2));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, lastTime + WEEK)).to.equal(ethers.utils.parseEther("1"));
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(afterWg1);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(afterWg1);
            expect(await gaugeController.getTotalWeight()).to.equal(afterWg1.mul(weight));
        });


        it("voteForGaugeWeights with two gauge", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            const { typeId, weight, gaugeWeight } = await preprareGauge();
            let userWeight = 6000;
            let userWeightV2 = 4000;

            await expect(await gaugeController.voteForGaugeWeights(mockGauge.address, userWeight)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGauge.address, anyValue, userWeight);
            await expect(await gaugeController.voteForGaugeWeights(mockGaugeV2.address, userWeightV2)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGaugeV2.address, anyValue, userWeightV2);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let gSlope = slope.mul(userWeight).div(10000);
            let g2Slope = slope.mul(userWeightV2).div(10000);
            let Wg = gSlope.mul((lockEnd.toNumber() - nextTime)).add(gaugeWeight);
            let Wg2 = g2Slope.mul((lockEnd.toNumber() - nextTime)).add(gaugeWeight);
            let totalWg = Wg.add(Wg2);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(Wg2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(totalWg);
            expect(await gaugeController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
        });

        it("voteForGaugeWeights with two gauge over time", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            const { typeId, weight, gaugeWeight } = await preprareGauge();
            let userWeight = 6000;
            let userWeightV2 = 4000;
            let lastTime = await time.latest();

            await expect(await gaugeController.voteForGaugeWeights(mockGauge.address, userWeight)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGauge.address, anyValue, userWeight);
            await expect(await gaugeController.voteForGaugeWeights(mockGaugeV2.address, userWeightV2)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGaugeV2.address, anyValue, userWeightV2);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let gSlope = slope.mul(userWeight).div(10000);
            let g2Slope = slope.mul(userWeightV2).div(10000);
            let Wg = gSlope.mul((lockEnd.toNumber() - nextTime)).add(gaugeWeight);
            let Wg2 = g2Slope.mul((lockEnd.toNumber() - nextTime)).add(gaugeWeight);
            let totalWg = Wg.add(Wg2);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(Wg2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(totalWg);
            expect(await gaugeController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));


            await time.setNextBlockTimestamp(nextTime);
            await gaugeController.checkpointGauge(mockGauge.address);
            await gaugeController.checkpointGauge(mockGaugeV2.address);
            let afterWg = gSlope.mul((lockEnd.toNumber() - nextTime - WEEK)).add(gaugeWeight);
            let afterWg2 = g2Slope.mul((lockEnd.toNumber() - nextTime - WEEK)).add(gaugeWeight);
            let afterTotalWg = afterWg.add(afterWg2);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(afterWg);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(afterWg2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(afterTotalWg);
            expect(await gaugeController.getTotalWeight()).to.equal(afterTotalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime + WEEK)).to.equal(afterWg.mul(ethers.utils.parseEther("1")).div(afterTotalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime + WEEK)).to.equal(afterWg2.mul(ethers.utils.parseEther("1")).div(afterTotalWg));

        });

        it("voteForGaugeWeights with two type and two gauge", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            let typeId1 = await gaugeController.nGaugeTypes();
            let name1 = "LT Staking Type 1";
            await gaugeController.addType(name1, weight);
            await gaugeController.addGauge(mockGauge.address, typeId, 0);
            await gaugeController.addGauge(mockGaugeV2.address, typeId1, 0);
            let userWeight = 6000;
            let userWeightV2 = 4000;

            await expect(await gaugeController.voteForGaugeWeights(mockGauge.address, userWeight)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGauge.address, anyValue, userWeight);
            await expect(await gaugeController.voteForGaugeWeights(mockGaugeV2.address, userWeightV2)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGaugeV2.address, anyValue, userWeightV2);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let gSlope = slope.mul(userWeight).div(10000);
            let g2Slope = slope.mul(userWeightV2).div(10000);
            let Wg = gSlope.mul((lockEnd.toNumber() - nextTime));
            let Wg2 = g2Slope.mul((lockEnd.toNumber() - nextTime));
            let totalWg = Wg.add(Wg2);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(Wg2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gaugeController.getWeightsSumPreType(typeId1)).to.equal(Wg2);
            expect(await gaugeController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
        });

        it("voteForGaugeWeights with two type and two gauge over time", async function () {
            const { gaugeController, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            let typeId1 = await gaugeController.nGaugeTypes();
            let name1 = "LT Staking Type 1";
            await gaugeController.addType(name1, weight);
            await gaugeController.addGauge(mockGauge.address, typeId, 0);
            await gaugeController.addGauge(mockGaugeV2.address, typeId1, 0);
            let userWeight = 6000;
            let userWeightV2 = 4000;

            await expect(await gaugeController.voteForGaugeWeights(mockGauge.address, userWeight)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGauge.address, anyValue, userWeight);
            await expect(await gaugeController.voteForGaugeWeights(mockGaugeV2.address, userWeightV2)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGaugeV2.address, anyValue, userWeightV2);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let gSlope = slope.mul(userWeight).div(10000);
            let g2Slope = slope.mul(userWeightV2).div(10000);
            let Wg = gSlope.mul((lockEnd.toNumber() - nextTime));
            let Wg2 = g2Slope.mul((lockEnd.toNumber() - nextTime));
            let totalWg = Wg.add(Wg2);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(Wg2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gaugeController.getWeightsSumPreType(typeId1)).to.equal(Wg2);
            expect(await gaugeController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));



            await time.setNextBlockTimestamp(nextTime);
            await gaugeController.checkpointGauge(mockGauge.address);
            await gaugeController.checkpointGauge(mockGaugeV2.address);
            let afterWg = gSlope.mul((lockEnd.toNumber() - nextTime - WEEK));
            let afterWg2 = g2Slope.mul((lockEnd.toNumber() - nextTime - WEEK));
            let afterTotalWg = afterWg.add(afterWg2);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(afterWg);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(afterWg2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(afterWg);
            expect(await gaugeController.getWeightsSumPreType(typeId1)).to.equal(afterWg2);
            expect(await gaugeController.getTotalWeight()).to.equal(afterTotalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime + WEEK)).to.equal(afterWg.mul(ethers.utils.parseEther("1")).div(afterTotalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime + WEEK)).to.equal(afterWg2.mul(ethers.utils.parseEther("1")).div(afterTotalWg));
        });

        it("voteForGaugeWeights with two type and two gauge and two user", async function () {
            const { gaugeController, permit2, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, thridAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            let typeId1 = await gaugeController.nGaugeTypes();
            let name1 = "LT Staking Type 1";
            await gaugeController.addType(name1, weight);
            await gaugeController.addGauge(mockGauge.address, typeId, 0);
            await gaugeController.addGauge(mockGaugeV2.address, typeId1, 0);

            //lock lt for otherAccount
            const MAXTIME = 4 * 365 * 86400;
            let ti = await time.latest();
            let lockTime = ti + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            let lockLTAmount = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, lockLTAmount, NONCE, DEADLINE);
            await veLT.createLockFor(otherAccount.address, lockLTAmount, lockTime, NONCE, DEADLINE, sig);


            //lock lt for otherAccount
            ti = await time.latest();
            lockTime = ti + MAXTIME / 2;
            NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            lockLTAmount = ethers.utils.parseEther("200000");
            let sig1 = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, lockLTAmount, NONCE, DEADLINE);
            await veLT.createLockFor(thridAccount.address, lockLTAmount, lockTime, NONCE, DEADLINE, sig1);


            let userWeight = 5000;
            let userWeightV2 = 5000;
            await expect(await gaugeController.connect(otherAccount).voteForGaugeWeights(mockGauge.address, userWeight)).to.emit(gaugeController, "VoteForGauge").withArgs(otherAccount.address, mockGauge.address, anyValue, userWeight);
            await expect(await gaugeController.connect(thridAccount).voteForGaugeWeights(mockGaugeV2.address, userWeightV2)).to.emit(gaugeController, "VoteForGauge").withArgs(thridAccount.address, mockGaugeV2.address, anyValue, userWeightV2);

            let blcoTime = await time.latest();
            let lockEnd = await veLT.lockedEnd(otherAccount.address);
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(otherAccount.address);
            let gSlope = slope.mul(userWeight).div(10000);
            let Wg = gSlope.mul((lockEnd.toNumber() - nextTime));

            lockEnd = await veLT.lockedEnd(thridAccount.address);
            let slope2 = await veLT.getLastUserSlope(thridAccount.address);
            let gSlope2 = slope2.mul(userWeightV2).div(10000);
            let Wg2 = gSlope2.mul((lockEnd.toNumber() - nextTime));
            let totalWg = Wg.add(Wg2);
            // console.log(ethers.utils.formatEther(Wg.sub(Wg2)));
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(Wg2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gaugeController.getWeightsSumPreType(typeId1)).to.equal(Wg2);
            expect(await gaugeController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
        });

        it("voteForGaugeWeights with two type and two gauge and three user", async function () {
            const { gaugeController, permit2, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, thridAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            let typeId1 = await gaugeController.nGaugeTypes();
            let name1 = "LT Staking Type 1";
            await gaugeController.addType(name1, weight);
            await gaugeController.addGauge(mockGauge.address, typeId, 0);
            await gaugeController.addGauge(mockGaugeV2.address, typeId1, 0);

            //lock lt for otherAccount
            const MAXTIME = 4 * 365 * 86400;
            let ti = await time.latest();
            let lockTime = ti + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            let lockLTAmount = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, lockLTAmount, NONCE, DEADLINE);
            await veLT.createLockFor(otherAccount.address, lockLTAmount, lockTime, NONCE, DEADLINE, sig);


            //lock lt for otherAccount
            ti = await time.latest();
            lockTime = ti + MAXTIME / 2;
            NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            lockLTAmount = ethers.utils.parseEther("200000");
            let sig1 = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, lockLTAmount, NONCE, DEADLINE);
            await veLT.createLockFor(thridAccount.address, lockLTAmount, lockTime, NONCE, DEADLINE, sig1);


            let userWeight = 5000;
            let userWeightV2 = 5000;
            await expect(await gaugeController.connect(otherAccount).voteForGaugeWeights(mockGauge.address, userWeight)).to.emit(gaugeController, "VoteForGauge").withArgs(otherAccount.address, mockGauge.address, anyValue, userWeight);
            await expect(await gaugeController.connect(thridAccount).voteForGaugeWeights(mockGaugeV2.address, userWeightV2)).to.emit(gaugeController, "VoteForGauge").withArgs(thridAccount.address, mockGaugeV2.address, anyValue, userWeightV2);

            let blcoTime = await time.latest();
            let lockEnd = await veLT.lockedEnd(otherAccount.address);
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(otherAccount.address);
            let gSlope = slope.mul(userWeight).div(10000);
            let Wg = gSlope.mul((lockEnd.toNumber() - nextTime));

            lockEnd = await veLT.lockedEnd(thridAccount.address);
            let slope2 = await veLT.getLastUserSlope(thridAccount.address);
            let gSlope2 = slope2.mul(userWeightV2).div(10000);
            let Wg2 = gSlope2.mul((lockEnd.toNumber() - nextTime));
            let totalWg = Wg.add(Wg2);
            // console.log(ethers.utils.formatEther(Wg.sub(Wg2)));
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(Wg2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gaugeController.getWeightsSumPreType(typeId1)).to.equal(Wg2);
            expect(await gaugeController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));

            let userWeightV3 = 10000;
            await expect(await gaugeController.voteForGaugeWeights(mockGaugeV2.address, userWeightV3)).to.emit(gaugeController, "VoteForGauge").withArgs(owner.address, mockGaugeV2.address, anyValue, userWeightV3);
            let lockEnd3 = await veLT.lockedEnd(owner.address);
            let slope3 = await veLT.getLastUserSlope(owner.address);
            let Wg3 = slope3.mul((lockEnd3.toNumber() - nextTime));
            let afterTotalWg = totalWg.add(Wg3);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(Wg2.add(Wg3));
            expect(await gaugeController.getWeightsSumPreType(typeId1)).to.equal(Wg2.add(Wg3));
            expect(await gaugeController.getTotalWeight()).to.equal(afterTotalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(afterTotalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.add(Wg3).mul(ethers.utils.parseEther("1")).div(afterTotalWg));
        });

        it("should revert right error when batchVoteForGaugeWeights use too much power", async function () {
            const { gaugeController, permit2, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, thridAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            let typeId1 = await gaugeController.nGaugeTypes();
            let name1 = "LT Staking Type 1";
            await gaugeController.addType(name1, weight);
            await gaugeController.addGauge(mockGauge.address, typeId, 0);
            await gaugeController.addGauge(mockGaugeV2.address, typeId1, 0);

            //lock lt for otherAccount
            const MAXTIME = 4 * 365 * 86400;
            let ti = await time.latest();
            let lockTime = ti + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            let lockLTAmount = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, lockLTAmount, NONCE, DEADLINE);
            await veLT.createLockFor(otherAccount.address, lockLTAmount, lockTime, NONCE, DEADLINE, sig);

            let userWeight = 5000;
            let userWeightV2 = 6000;
            await expect(gaugeController.connect(otherAccount).batchVoteForGaugeWeights([mockGauge.address, mockGaugeV2.address], [userWeight, userWeightV2])).to.be.revertedWith("GC006");
        });

        it("batchVoteForGaugeWeights with two type and two gauge ", async function () {
            const { gaugeController, permit2, mockGauge, mockGaugeV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gaugeController.nGaugeTypes();
            await gaugeController.addType(name, weight);
            let typeId1 = await gaugeController.nGaugeTypes();
            let name1 = "LT Staking Type 1";
            await gaugeController.addType(name1, weight);
            await gaugeController.addGauge(mockGauge.address, typeId, 0);
            await gaugeController.addGauge(mockGaugeV2.address, typeId1, 0);

            //lock lt for otherAccount
            const MAXTIME = 4 * 365 * 86400;
            let ti = await time.latest();
            let lockTime = ti + MAXTIME;
            const DEADLINE = await time.latest() + 60 * 60;
            let NONCE = BigNumber.from(ethers.utils.randomBytes(32));
            let lockLTAmount = ethers.utils.parseEther("100000");
            const sig = await PermitSigHelper.signature(owner, eRC20LT.address, permit2.address, veLT.address, lockLTAmount, NONCE, DEADLINE);
            await veLT.createLockFor(otherAccount.address, lockLTAmount, lockTime, NONCE, DEADLINE, sig);


            let userWeight = 5000;
            let userWeightV2 = 5000;
            await gaugeController.connect(otherAccount).batchVoteForGaugeWeights([mockGauge.address, mockGaugeV2.address], [userWeight, userWeightV2])

            let blcoTime = await time.latest();
            let lockEnd = await veLT.lockedEnd(otherAccount.address);
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(otherAccount.address);
            let gSlope = slope.mul(userWeight).div(10000);
            let Wg = gSlope.mul((lockEnd.toNumber() - nextTime));

            lockEnd = await veLT.lockedEnd(otherAccount.address);
            let slope2 = await veLT.getLastUserSlope(otherAccount.address);
            let gSlope2 = slope2.mul(userWeightV2).div(10000);
            let Wg2 = gSlope2.mul((lockEnd.toNumber() - nextTime));
            let totalWg = Wg.add(Wg2);
            expect(await gaugeController.getGaugeWeight(mockGauge.address)).to.equal(Wg);
            expect(await gaugeController.getGaugeWeight(mockGaugeV2.address)).to.equal(Wg2);
            expect(await gaugeController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gaugeController.getWeightsSumPreType(typeId1)).to.equal(Wg2);
            expect(await gaugeController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gaugeController.gaugeRelativeWeight(mockGauge.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gaugeController.gaugeRelativeWeight(mockGaugeV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
        });
    })
})