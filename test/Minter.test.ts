import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("Minter", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();

        let MyERC20LT = await ethers.getContractFactory("LT");
        const eRC20LT = await upgrades.deployProxy(MyERC20LT, ['Light Dao Token', 'LT']);
        await eRC20LT.deployed();
        await time.increase(2 * 86400);
        await eRC20LT.updateMiningParameters();

        const GaugeController = await ethers.getContractFactory("GaugeController");
        const gaugeController = await GaugeController.deploy(eRC20LT.address, eRC20LT.address);
        await gaugeController.deployed();
        await gaugeController.addType('test', 1000);

        const MockGauge = await ethers.getContractFactory("MockGauge");
        const mockGauge = await MockGauge.deploy();
        await mockGauge.deployed();
        await gaugeController.addGauge(mockGauge.address, 0, 10000);

        const MockGaugeV2 = await ethers.getContractFactory("MockGaugeV2");
        const mockGaugeV2 = await MockGaugeV2.deploy();
        await mockGaugeV2.deployed();
        await gaugeController.addGauge(mockGaugeV2.address, 0, 10000);

        const Minter = await ethers.getContractFactory("Minter");
        const minter = await Minter.deploy(eRC20LT.address, gaugeController.address);
        await minter.deployed();

        await eRC20LT.setMinter(minter.address);

        return { eRC20LT, gaugeController, minter, mockGauge, mockGaugeV2, owner, otherAccount };
    }


    describe("Minter", async function () {

        it("should revert right error when gauge invalid", async function () {

            const { eRC20LT, minter, mockGauge, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            await expect(minter.connect(otherAccount).mint(eRC20LT.address)).to.revertedWith("CE000")
        });

        it("mint", async function () {

            const { eRC20LT, minter, mockGauge, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(0);
            await expect(await minter.connect(otherAccount).mint(mockGauge.address)).to.emit(minter, "Minted").withArgs(otherAccount.address, mockGauge.address, ethers.utils.parseEther("100"));
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGauge.address)).to.equal(ethers.utils.parseEther("100"));

            await minter.connect(otherAccount).mint(mockGauge.address);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGauge.address)).to.equal(ethers.utils.parseEther("100"));
        });


        it("mint many", async function () {

            const { eRC20LT, minter, mockGauge, mockGaugeV2, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            await minter.connect(otherAccount).mintMany([mockGauge.address, mockGaugeV2.address, ethers.constants.AddressZero]);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("200"));
            expect(await minter.minted(otherAccount.address, mockGauge.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGaugeV2.address)).to.equal(ethers.utils.parseEther("100"));

            await minter.connect(otherAccount).mintMany([mockGaugeV2.address]);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("300"));
            expect(await minter.minted(otherAccount.address, mockGaugeV2.address)).to.equal(ethers.utils.parseEther("200"));
        });

        it("mint for", async function () {

            const { eRC20LT, minter, mockGauge, mockGaugeV2, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            await minter.mintFor(mockGaugeV2.address, otherAccount.address);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("0"));
            expect(await minter.minted(otherAccount.address, mockGaugeV2.address)).to.equal(ethers.utils.parseEther("0"));

            await expect(await minter.connect(otherAccount).toggleApproveMint(owner.address)).to.emit(minter, "ToogleApproveMint").withArgs(otherAccount.address, owner.address, true);
            await minter.mintFor(mockGaugeV2.address, otherAccount.address);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGaugeV2.address)).to.equal(ethers.utils.parseEther("100"));

            await minter.connect(otherAccount).toggleApproveMint(owner.address);
            await minter.mintFor(mockGaugeV2.address, otherAccount.address);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGaugeV2.address)).to.equal(ethers.utils.parseEther("100"));
        });


    })




})