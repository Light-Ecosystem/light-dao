import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";


describe("LT", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();

        let MyLT = await ethers.getContractFactory("LT");
        const eRC20LT = await upgrades.deployProxy(MyLT, ['LT Dao Token', 'LT']);
        await eRC20LT.deployed();
        // console.log('eRC20LT address is', eRC20LT.address);

        await time.increase(2 * 86400 + 10);
        await eRC20LT.updateMiningParameters();

        let RATE_REDUCTION_TIME = 86400 * 365;

        return { eRC20LT, owner, otherAccount, RATE_REDUCTION_TIME };
    }

    describe("LT", function () {

        it("initialize check", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            expect(await eRC20LT.totalSupply()).to.be.equals(ethers.utils.parseEther('400000000000'));
            expect(await eRC20LT.balanceOf(owner.address)).to.be.equals(ethers.utils.parseEther('400000000000'));
            expect(await eRC20LT.rate()).to.be.equals(ethers.BigNumber.from('3027650938609842719431'));
        });


        it("shoule revert right error when updateMiningParameters too soon", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            await expect(eRC20LT.updateMiningParameters()).to.be.revertedWith('BA000');
        });

        it("updateMiningParameters when mingEpoch is 2", async function () {
            const { eRC20LT, owner, otherAccount, RATE_REDUCTION_TIME } = await loadFixture(deployOneYearLockFixture);

            await time.increase(RATE_REDUCTION_TIME);
            await expect(await eRC20LT.updateMiningParameters())
                .to.emit(eRC20LT, "UpdateMiningParameters")
                .withArgs(anyValue, ethers.BigNumber.from('2545940820916560992283'), ethers.BigNumber.from('495479999999999999999976016000'));
            expect(await eRC20LT.rate()).to.be.equals(ethers.BigNumber.from('2545940820916560992283'));

        });


        it("futureEpochTimeWrite", async function () {
            const { eRC20LT, owner, otherAccount, RATE_REDUCTION_TIME } = await loadFixture(deployOneYearLockFixture);

            let startTime = await eRC20LT.startEpochTime();
            await eRC20LT.futureEpochTimeWrite();
            expect(await eRC20LT.startEpochTime()).to.be.equal(startTime);

            await time.increase(RATE_REDUCTION_TIME);
            await eRC20LT.futureEpochTimeWrite();
            expect(await eRC20LT.startEpochTime()).to.be.equal(startTime.add(31536000));

        });

        it("availableSupply", async function () {
            const { eRC20LT, owner, otherAccount, RATE_REDUCTION_TIME } = await loadFixture(deployOneYearLockFixture);

            let startTime = await eRC20LT.startEpochTime();
            let startEpochSupply = await eRC20LT.startEpochSupply();
            let rate = await eRC20LT.rate();
            let lastTime = await time.latest();
            let timeGap = ethers.BigNumber.from(lastTime).sub(startTime);
            expect(await eRC20LT.availableSupply()).to.be.equal(startEpochSupply.add(timeGap.mul(rate)));
        });
    });

    describe("LT mint and burn", function () {

        it("shoule revert right error when set minter twice", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await eRC20LT.setMinter(owner.address);
            await expect(eRC20LT.setMinter(ethers.constants.AddressZero)).to.be.revertedWith('BA003');
        });


        it("emit SetMinter when set minter success", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await expect(await eRC20LT.setMinter(owner.address))
                .to.emit(eRC20LT, "SetMinter")
                .withArgs(owner.address);
            ;
        });

        it("shoule revert right error when not minter mint", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await expect(eRC20LT.mint(owner.address, 10000)).to.be.revertedWith('BA004');
        });

        it("shoule revert right error when mint `to` address is zero", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await eRC20LT.setMinter(owner.address);
            await expect(eRC20LT.mint(ethers.constants.AddressZero, 10000)).to.be.revertedWith('CE000');
        });

        it("shoule revert right error when exceeds allowable mint amount", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await eRC20LT.setMinter(owner.address);
            let supply = await eRC20LT.availableSupply();
            await expect(eRC20LT.mint(owner.address, supply)).to.be.revertedWith('BA005');
        });


        it("mint success", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await eRC20LT.setMinter(owner.address);
            let value = ethers.utils.parseEther("1000");
            await expect(await eRC20LT.mint(otherAccount.address, value)).to.emit(eRC20LT, 'Transfer')
                .withArgs(ethers.constants.AddressZero, otherAccount.address, value);

            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(value);
        });

        it("burn success", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            await eRC20LT.setMinter(owner.address);
            let value = ethers.utils.parseEther("1000");
            await eRC20LT.mint(otherAccount.address, value);
            await expect(await eRC20LT.connect(otherAccount).burn(value)).to.emit(eRC20LT, 'Transfer')
                .withArgs(otherAccount.address, ethers.constants.AddressZero, value);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(0);
        });

        it("shoule revert right error when mintableInTimeframe start > end", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            let t = await time.latest();
            let start = t;
            let end = start + 10000;
            await expect(eRC20LT.mintableInTimeframe(end, start)).to.be.revertedWith('BA001');
        });

        it("shoule revert right error when mintableInTimeframe too far in future", async function () {
            const { eRC20LT, owner, otherAccount, RATE_REDUCTION_TIME } = await loadFixture(deployOneYearLockFixture);

            let t = await time.latest();
            let start = t;
            let end = await eRC20LT.startEpochTime();
            end = end.add(RATE_REDUCTION_TIME * 3);
            await expect(eRC20LT.mintableInTimeframe(start, end)).to.be.revertedWith('BA002');
        });

        it("mintableInTimeframe start-end ==> t,t+10000", async function () {
            const { eRC20LT, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);

            let t = await time.latest();
            let start = t;
            let end = start + 10000;
            let mintable = await eRC20LT.mintableInTimeframe(start, end);
            let rate = await eRC20LT.rate();
            expect(mintable).to.equal(rate.mul(10000));
        });

        it("mintableInTimeframe two years", async function () {
            const { eRC20LT, owner, otherAccount, RATE_REDUCTION_TIME } = await loadFixture(deployOneYearLockFixture);

            let t = await eRC20LT.startEpochTime();
            let start = t;
            let end = start.add(RATE_REDUCTION_TIME * 2);
            let mintable = await eRC20LT.mintableInTimeframe(start, end);
            let expectValue = ethers.BigNumber.from('3027650938609842719430').mul((86400 * 365)).add(ethers.BigNumber.from('2545940820916560992283').mul(86400 * 365));
            expect(mintable).to.equal(expectValue);
        });

    });

    describe("LT owner", function () {

        it("LT owner", async function () {
            const { eRC20LT, owner, otherAccount, RATE_REDUCTION_TIME } = await loadFixture(deployOneYearLockFixture);

            expect(await eRC20LT.owner()).to.equal(owner.address);
        });

        it("LT transferOwner", async function () {
            const { eRC20LT, owner, otherAccount, RATE_REDUCTION_TIME } = await loadFixture(deployOneYearLockFixture);

            await eRC20LT.transferOwnership(otherAccount.address);
            expect(await eRC20LT.owner()).to.equal(owner.address);
            expect(await eRC20LT.pendingOwner()).to.equal(otherAccount.address);

            await eRC20LT.connect(otherAccount).acceptOwnership();
            expect(await eRC20LT.owner()).to.equal(otherAccount.address);
            expect(await eRC20LT.pendingOwner()).to.equal(ethers.constants.AddressZero);
        });
    });


    describe("LT transfer", function () {

        it("LT approve and transferFrom", async function () {
            const { eRC20LT, owner, otherAccount, RATE_REDUCTION_TIME } = await loadFixture(deployOneYearLockFixture);

            await eRC20LT.approve(otherAccount.address, 10000);
            expect(await eRC20LT.allowance(owner.address, otherAccount.address)).to.equal(10000);

            await eRC20LT.connect(otherAccount).transferFrom(owner.address, otherAccount.address, 5000);
            expect(await eRC20LT.allowance(owner.address, otherAccount.address)).to.equal(5000);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(5000);
        });

    });

});
