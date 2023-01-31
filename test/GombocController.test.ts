import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { PermitSigHelper } from "./PermitSigHelper";
import { BigNumber } from "ethers";


describe("GombocController", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount, thridAccount] = await ethers.getSigners();

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

        const GombocController = await ethers.getContractFactory("GombocController");
        const gombocController = await GombocController.deploy(eRC20LT.address, veLT.address);
        await gombocController.deployed();

        const MockGomboc = await ethers.getContractFactory("MockGomboc");
        const mockGomboc = await MockGomboc.deploy();
        await mockGomboc.deployed();

        const MockGombocV2 = await ethers.getContractFactory("MockGombocV2");
        const mockGombocV2 = await MockGombocV2.deploy();
        await mockGombocV2.deployed();

        return { eRC20LT, gombocController, mockGomboc, mockGombocV2, veLT, permit2, owner, otherAccount, thridAccount, WEEK, MAXTIME };
    }

    async function preprareGomboc() {
        const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, WEEK } = await loadFixture(deployOneYearLockFixture);

        //prepare data
        let name = "LT Staking Type";
        let weight = ethers.utils.parseEther("1");
        let typeId = await gombocController.nGombocTypes();
        await gombocController.addType(name, weight);
        let gombocWeight = ethers.utils.parseEther("1");
        await gombocController.addGomboc(mockGomboc.address, typeId, gombocWeight);
        await gombocController.addGomboc(mockGombocV2.address, typeId, gombocWeight);

        return { typeId, weight, gombocWeight };
    }


    describe("GombocController Type Manage", async function () {

        it("addType", async function () {

            const { gombocController, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await expect(await gombocController.addType(name, weight)).to.emit(gombocController, 'AddType').withArgs(name, typeId);

            expect(await gombocController.nGombocTypes()).to.equal(typeId.add(1));
            expect(await gombocController.gombocTypeNames(typeId)).to.equal(name);
            expect(await gombocController.getTypeWeight(typeId)).to.equal(weight);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(0);
            expect(await gombocController.getTotalWeight()).to.equal(0);
        });

        it("addType twice", async function () {

            const { gombocController, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await expect(await gombocController.addType(name, weight)).to.emit(gombocController, 'AddType').withArgs(name, typeId);
            expect(await gombocController.nGombocTypes()).to.equal(typeId.add(1));
            expect(await gombocController.gombocTypeNames(typeId)).to.equal(name);
            expect(await gombocController.getTypeWeight(typeId)).to.equal(weight);


            let typeId1 = await gombocController.nGombocTypes();
            let name1 = "LT SWAP POOL1";
            await expect(await gombocController.addType(name1, weight)).to.emit(gombocController, 'AddType').withArgs(name1, typeId1);
            expect(await gombocController.nGombocTypes()).to.equal(typeId1.add(1));
            expect(await gombocController.getTypeWeight(typeId1)).to.equal(weight);
            expect(await gombocController.gombocTypeNames(typeId1)).to.equal(name1);

            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(0);
            expect(await gombocController.getTotalWeight()).to.equal(0);
        });

        it("changeTypeWeight when no veLT vote", async function () {

            const { gombocController, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);

            //test
            let weight2 = ethers.utils.parseEther("2");
            await gombocController.changeTypeWeight(typeId, weight2);
            expect(await gombocController.getTypeWeight(typeId)).to.equal(weight2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(0);
            expect(await gombocController.getTotalWeight()).to.equal(0);
        });


        it("changeTypeWeight when has veLT vote", async function () {

            const { gombocController, mockGomboc, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);
            await gombocController.addGomboc(mockGomboc.address, typeId, weight);


            //test
            let weight2 = ethers.utils.parseEther("2");
            await gombocController.changeTypeWeight(typeId, weight2);
            expect(await gombocController.getTypeWeight(typeId)).to.equal(weight2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(weight);
            expect(await gombocController.getTotalWeight()).to.equal(weight2.mul(weight));
        });
    })

    describe("GombocController Gomboc Manage", async function () {

        it("should revert right error when typeId is invalid", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await expect(gombocController.addGomboc(mockGomboc.address, 0, 0)).to.revertedWith("GC001");
        });

        it("should revert right error when add gomboc twice", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);
            gombocController.addGomboc(mockGomboc.address, typeId, 0);

            //test
            await expect(gombocController.addGomboc(mockGomboc.address, typeId, 0)).to.revertedWith("GC002");
        });


        it("addGomboc with zero weight", async function () {

            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);

            //test
            await expect(await gombocController.addGomboc(mockGomboc.address, typeId, 0)).to.emit(gombocController, "NewGomboc").withArgs(mockGomboc.address, typeId, 0);
            expect(await gombocController.gombocTypes(mockGomboc.address)).to.equal(typeId);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(0);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(0);
            expect(await gombocController.getTotalWeight()).to.equal(0);
        });

        it("addGomboc with weight", async function () {

            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, WEEK } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);

            //test
            let gombocWeight = ethers.utils.parseEther("1");
            await expect(await gombocController.addGomboc(mockGomboc.address, typeId, gombocWeight)).to.emit(gombocController, "NewGomboc").withArgs(mockGomboc.address, typeId, gombocWeight);
            expect(await gombocController.gombocTypes(mockGomboc.address)).to.equal(typeId);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(gombocWeight);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(gombocWeight);
            expect(await gombocController.getTotalWeight()).to.equal(gombocWeight.mul(weight));

            //addGomboc Weight will not decrease over time
            await time.increase(WEEK * 10);
            await gombocController.checkpointGomboc(mockGomboc.address);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(gombocWeight);
            expect(await gombocController.getTotalWeight()).to.equal(gombocWeight.mul(weight));
        });

        it("addGomboc with two gomboc", async function () {

            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, WEEK } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);

            //test
            let gombocWeight = ethers.utils.parseEther("1");
            await expect(await gombocController.addGomboc(mockGomboc.address, typeId, gombocWeight)).to.emit(gombocController, "NewGomboc").withArgs(mockGomboc.address, typeId, gombocWeight);
            expect(await gombocController.gombocTypes(mockGomboc.address)).to.equal(typeId);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(gombocWeight);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(gombocWeight);
            expect(await gombocController.getTotalWeight()).to.equal(gombocWeight.mul(weight));

            let gombocWeight1 = ethers.utils.parseEther("2");
            await expect(await gombocController.addGomboc(mockGombocV2.address, typeId, gombocWeight1)).to.emit(gombocController, "NewGomboc").withArgs(mockGombocV2.address, typeId, gombocWeight1);
            expect(await gombocController.gombocTypes(mockGombocV2.address)).to.equal(typeId);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(gombocWeight.add(gombocWeight1));
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(gombocWeight1);
            expect(await gombocController.getTotalWeight()).to.equal((gombocWeight.add(gombocWeight1)).mul(weight));

            let lastTime = await time.latest();
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, lastTime)).to.equal(BigNumber.from("0"));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, lastTime + WEEK)).to.equal(BigNumber.from("666666666666666666"));
        });

        it("should revert right error when gomboc not addd", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await expect(gombocController.changeGombocWeight(mockGomboc.address, 0)).to.revertedWith("GC000");
        });

        it("changeGombocWeight", async function () {

            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, WEEK } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            await preprareGomboc();
            let typeId = 0;
            let weight = ethers.utils.parseEther("1");

            let gombocWeight = ethers.utils.parseEther("1");
            //test
            let gombocWeight1 = ethers.utils.parseEther("2");
            await expect(await gombocController.changeGombocWeight(mockGomboc.address, gombocWeight1)).to.emit(gombocController, "NewGombocWeight").withArgs(mockGomboc.address, anyValue, gombocWeight1, (gombocWeight1.add(gombocWeight)).mul(weight));
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(gombocWeight1.add(gombocWeight));
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(gombocWeight1);
            expect(await gombocController.getTotalWeight()).to.equal(gombocWeight1.add(gombocWeight).mul(weight));

            await expect(await gombocController.changeGombocWeight(mockGombocV2.address, gombocWeight1)).to.emit(gombocController, "NewGombocWeight").withArgs(mockGombocV2.address, anyValue, gombocWeight1, gombocWeight1.mul(2).mul(weight));
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(gombocWeight1.add(gombocWeight1));
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(gombocWeight1);
            expect(await gombocController.getTotalWeight()).to.equal((gombocWeight1.add(gombocWeight1)).mul(weight));

            let lastTime = await time.latest();
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, lastTime)).to.equal(BigNumber.from("0"));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, lastTime + WEEK)).to.equal(BigNumber.from("500000000000000000"));
        });
    })

    describe("voteForGombocWeights", async function () {

        it("should revert right error when Gomboc not added", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            let userWeight = 10001;
            await expect(gombocController.voteForGombocWeights(mockGomboc.address, userWeight)).to.revertedWith("GC000");
        });

        it("should revert right error when veLT Lock expire", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            await preprareGomboc();

            let userWeight = 1000;
            await expect(gombocController.connect(otherAccount).voteForGombocWeights(mockGomboc.address, userWeight)).to.revertedWith("GC003");
        });

        it("should revert right error when userWeight greater than 100%", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            //prepare data
            await preprareGomboc();

            let userWeight = 10001;
            await expect(gombocController.voteForGombocWeights(mockGomboc.address, userWeight)).to.revertedWith("GC004");
        });

        it("should revert right error when vote so often", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            await preprareGomboc();
            let userWeight = 10000;
            gombocController.voteForGombocWeights(mockGomboc.address, userWeight);

            await expect(gombocController.voteForGombocWeights(mockGomboc.address, userWeight)).to.revertedWith("GC005");
        });

        it("voteForGombocWeights ", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, veLT } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            await preprareGomboc();
            let userWeight = 10000;
            gombocController.voteForGombocWeights(mockGomboc.address, userWeight);
            gombocController.voteForGombocWeights(mockGombocV2.address, userWeight)

            let WEIGHT_VOTE_DELAY = 10 * 86400;
            await time.increase(WEIGHT_VOTE_DELAY);
            gombocController.voteForGombocWeights(mockGomboc.address, userWeight / 10);
            gombocController.voteForGombocWeights(mockGombocV2.address, userWeight / 10)
        });


        it("voteForGombocWeights one gomboc", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);
            let gombocWeight = ethers.utils.parseEther("1");
            await gombocController.addGomboc(mockGomboc.address, typeId, gombocWeight);
            let userWeight = 10000;
            let lastTime = await time.latest();

            await expect(await gombocController.voteForGombocWeights(mockGomboc.address, userWeight)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGomboc.address, anyValue, userWeight);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let Wg = slope.mul((lockEnd.toNumber() - nextTime));
            Wg = Wg.add(gombocWeight);
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, lastTime + WEEK)).to.equal(BigNumber.from("1000000000000000000"));
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(Wg);
            expect(await gombocController.getTotalWeight()).to.equal(Wg.mul(weight));
        });


        it("voteForGombocWeights with over time", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);
            let gombocWeight = ethers.utils.parseEther("1");
            await gombocController.addGomboc(mockGomboc.address, typeId, gombocWeight);
            let userWeight = 10000;
            let lastTime = await time.latest();

            await expect(await gombocController.voteForGombocWeights(mockGomboc.address, userWeight)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGomboc.address, anyValue, userWeight);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let Wg = slope.mul((lockEnd.toNumber() - nextTime));
            Wg = Wg.add(gombocWeight);
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, lastTime + WEEK)).to.equal(ethers.utils.parseEther("1"));
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(Wg);
            expect(await gombocController.getTotalWeight()).to.equal(Wg.mul(weight));


            await time.setNextBlockTimestamp(nextTime);
            await gombocController.checkpoint();
            let afterWg = Wg.sub(slope.mul(WEEK));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, lastTime + WEEK)).to.equal(ethers.utils.parseEther("1"));
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(Wg);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(afterWg);
            expect(await gombocController.getTotalWeight()).to.equal(afterWg.mul(weight));


            await time.setNextBlockTimestamp(nextTime + WEEK);
            await gombocController.checkpointGomboc(mockGomboc.address);
            let afterWg1 = Wg.sub(slope.mul(WEEK * 2));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, lastTime + WEEK)).to.equal(ethers.utils.parseEther("1"));
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(afterWg1);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(afterWg1);
            expect(await gombocController.getTotalWeight()).to.equal(afterWg1.mul(weight));
        });


        it("voteForGombocWeights with two gomboc", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            const { typeId, weight, gombocWeight } = await preprareGomboc();
            let userWeight = 6000;
            let userWeightV2 = 4000;

            await expect(await gombocController.voteForGombocWeights(mockGomboc.address, userWeight)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGomboc.address, anyValue, userWeight);
            await expect(await gombocController.voteForGombocWeights(mockGombocV2.address, userWeightV2)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGombocV2.address, anyValue, userWeightV2);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let gSlope = slope.mul(userWeight).div(10000);
            let g2Slope = slope.mul(userWeightV2).div(10000);
            let Wg = gSlope.mul((lockEnd.toNumber() - nextTime)).add(gombocWeight);
            let Wg2 = g2Slope.mul((lockEnd.toNumber() - nextTime)).add(gombocWeight);
            let totalWg = Wg.add(Wg2);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(Wg);
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(Wg2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(totalWg);
            expect(await gombocController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
        });

        it("voteForGombocWeights with two gomboc over time", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            const { typeId, weight, gombocWeight } = await preprareGomboc();
            let userWeight = 6000;
            let userWeightV2 = 4000;
            let lastTime = await time.latest();

            await expect(await gombocController.voteForGombocWeights(mockGomboc.address, userWeight)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGomboc.address, anyValue, userWeight);
            await expect(await gombocController.voteForGombocWeights(mockGombocV2.address, userWeightV2)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGombocV2.address, anyValue, userWeightV2);

            let lockEnd = await veLT.lockedEnd(owner.address);
            let blcoTime = await time.latest();
            let nextTime = blcoTime + WEEK;
            nextTime = nextTime - nextTime % WEEK;
            let slope = await veLT.getLastUserSlope(owner.address);
            let gSlope = slope.mul(userWeight).div(10000);
            let g2Slope = slope.mul(userWeightV2).div(10000);
            let Wg = gSlope.mul((lockEnd.toNumber() - nextTime)).add(gombocWeight);
            let Wg2 = g2Slope.mul((lockEnd.toNumber() - nextTime)).add(gombocWeight);
            let totalWg = Wg.add(Wg2);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(Wg);
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(Wg2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(totalWg);
            expect(await gombocController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));


            await time.setNextBlockTimestamp(nextTime);
            await gombocController.checkpointGomboc(mockGomboc.address);
            await gombocController.checkpointGomboc(mockGombocV2.address);
            let afterWg = gSlope.mul((lockEnd.toNumber() - nextTime - WEEK)).add(gombocWeight);
            let afterWg2 = g2Slope.mul((lockEnd.toNumber() - nextTime - WEEK)).add(gombocWeight);
            let afterTotalWg = afterWg.add(afterWg2);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(afterWg);
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(afterWg2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(afterTotalWg);
            expect(await gombocController.getTotalWeight()).to.equal(afterTotalWg.mul(weight));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime + WEEK)).to.equal(afterWg.mul(ethers.utils.parseEther("1")).div(afterTotalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime + WEEK)).to.equal(afterWg2.mul(ethers.utils.parseEther("1")).div(afterTotalWg));

        });

        it("voteForGombocWeights with two type and two gomboc", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);
            let typeId1 = await gombocController.nGombocTypes();
            let name1 = "LT Staking Type 1";
            await gombocController.addType(name1, weight);
            await gombocController.addGomboc(mockGomboc.address, typeId, 0);
            await gombocController.addGomboc(mockGombocV2.address, typeId1, 0);
            let userWeight = 6000;
            let userWeightV2 = 4000;

            await expect(await gombocController.voteForGombocWeights(mockGomboc.address, userWeight)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGomboc.address, anyValue, userWeight);
            await expect(await gombocController.voteForGombocWeights(mockGombocV2.address, userWeightV2)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGombocV2.address, anyValue, userWeightV2);

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
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(Wg);
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(Wg2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gombocController.getWeightsSumPreType(typeId1)).to.equal(Wg2);
            expect(await gombocController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
        });

        it("voteForGombocWeights with two type and two gomboc over time", async function () {
            const { gombocController, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);
            let typeId1 = await gombocController.nGombocTypes();
            let name1 = "LT Staking Type 1";
            await gombocController.addType(name1, weight);
            await gombocController.addGomboc(mockGomboc.address, typeId, 0);
            await gombocController.addGomboc(mockGombocV2.address, typeId1, 0);
            let userWeight = 6000;
            let userWeightV2 = 4000;

            await expect(await gombocController.voteForGombocWeights(mockGomboc.address, userWeight)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGomboc.address, anyValue, userWeight);
            await expect(await gombocController.voteForGombocWeights(mockGombocV2.address, userWeightV2)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGombocV2.address, anyValue, userWeightV2);

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
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(Wg);
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(Wg2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gombocController.getWeightsSumPreType(typeId1)).to.equal(Wg2);
            expect(await gombocController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));



            await time.setNextBlockTimestamp(nextTime);
            await gombocController.checkpointGomboc(mockGomboc.address);
            await gombocController.checkpointGomboc(mockGombocV2.address);
            let afterWg = gSlope.mul((lockEnd.toNumber() - nextTime - WEEK));
            let afterWg2 = g2Slope.mul((lockEnd.toNumber() - nextTime - WEEK));
            let afterTotalWg = afterWg.add(afterWg2);
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(afterWg);
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(afterWg2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(afterWg);
            expect(await gombocController.getWeightsSumPreType(typeId1)).to.equal(afterWg2);
            expect(await gombocController.getTotalWeight()).to.equal(afterTotalWg.mul(weight));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime + WEEK)).to.equal(afterWg.mul(ethers.utils.parseEther("1")).div(afterTotalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime + WEEK)).to.equal(afterWg2.mul(ethers.utils.parseEther("1")).div(afterTotalWg));
        });

        it("voteForGombocWeights with two type and two gomboc and two user", async function () {
            const { gombocController, permit2, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, thridAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);
            let typeId1 = await gombocController.nGombocTypes();
            let name1 = "LT Staking Type 1";
            await gombocController.addType(name1, weight);
            await gombocController.addGomboc(mockGomboc.address, typeId, 0);
            await gombocController.addGomboc(mockGombocV2.address, typeId1, 0);

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
            await expect(await gombocController.connect(otherAccount).voteForGombocWeights(mockGomboc.address, userWeight)).to.emit(gombocController, "VoteForGomboc").withArgs(otherAccount.address, mockGomboc.address, anyValue, userWeight);
            await expect(await gombocController.connect(thridAccount).voteForGombocWeights(mockGombocV2.address, userWeightV2)).to.emit(gombocController, "VoteForGomboc").withArgs(thridAccount.address, mockGombocV2.address, anyValue, userWeightV2);

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
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(Wg);
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(Wg2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gombocController.getWeightsSumPreType(typeId1)).to.equal(Wg2);
            expect(await gombocController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));
        });

        it("voteForGombocWeights with two type and two gomboc and three user", async function () {
            const { gombocController, permit2, mockGomboc, mockGombocV2, eRC20LT, owner, otherAccount, thridAccount, veLT, WEEK } = await loadFixture(deployOneYearLockFixture);
            //prepare data
            let name = "LT Staking Type";
            let weight = ethers.utils.parseEther("1");
            let typeId = await gombocController.nGombocTypes();
            await gombocController.addType(name, weight);
            let typeId1 = await gombocController.nGombocTypes();
            let name1 = "LT Staking Type 1";
            await gombocController.addType(name1, weight);
            await gombocController.addGomboc(mockGomboc.address, typeId, 0);
            await gombocController.addGomboc(mockGombocV2.address, typeId1, 0);

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
            await expect(await gombocController.connect(otherAccount).voteForGombocWeights(mockGomboc.address, userWeight)).to.emit(gombocController, "VoteForGomboc").withArgs(otherAccount.address, mockGomboc.address, anyValue, userWeight);
            await expect(await gombocController.connect(thridAccount).voteForGombocWeights(mockGombocV2.address, userWeightV2)).to.emit(gombocController, "VoteForGomboc").withArgs(thridAccount.address, mockGombocV2.address, anyValue, userWeightV2);

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
            expect(await gombocController.getGombocWeight(mockGomboc.address)).to.equal(Wg);
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(Wg2);
            expect(await gombocController.getWeightsSumPreType(typeId)).to.equal(Wg);
            expect(await gombocController.getWeightsSumPreType(typeId1)).to.equal(Wg2);
            expect(await gombocController.getTotalWeight()).to.equal(totalWg.mul(weight));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(totalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime)).to.equal(Wg2.mul(ethers.utils.parseEther("1")).div(totalWg));

            let userWeightV3 = 10000;
            await expect(await gombocController.voteForGombocWeights(mockGombocV2.address, userWeightV3)).to.emit(gombocController, "VoteForGomboc").withArgs(owner.address, mockGombocV2.address, anyValue, userWeightV3);
            let lockEnd3 = await veLT.lockedEnd(owner.address);
            let slope3 = await veLT.getLastUserSlope(owner.address);
            let Wg3 = slope3.mul((lockEnd3.toNumber() - nextTime));
            let afterTotalWg = totalWg.add(Wg3);
            expect(await gombocController.getGombocWeight(mockGombocV2.address)).to.equal(Wg2.add(Wg3));
            expect(await gombocController.getWeightsSumPreType(typeId1)).to.equal(Wg2.add(Wg3));
            expect(await gombocController.getTotalWeight()).to.equal(afterTotalWg.mul(weight));
            expect(await gombocController.gombocRelativeWeight(mockGomboc.address, nextTime)).to.equal(Wg.mul(ethers.utils.parseEther("1")).div(afterTotalWg));
            expect(await gombocController.gombocRelativeWeight(mockGombocV2.address, nextTime)).to.equal(Wg2.add(Wg3).mul(ethers.utils.parseEther("1")).div(afterTotalWg));
        });
    })
})