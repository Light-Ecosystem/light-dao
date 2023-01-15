import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Minter", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();

        let MyERC20LT = await ethers.getContractFactory("LT");
        const eRC20LT = await MyERC20LT.deploy();
        await eRC20LT.deployed();
        await eRC20LT.initialize('Light Dao Token', 'LT');
        await time.increase(86400);
        await eRC20LT.updateMiningParameters();

        const GombocController = await ethers.getContractFactory("GombocController");
        const gombocController = await GombocController.deploy(eRC20LT.address, eRC20LT.address);
        await gombocController.deployed();
        await gombocController.addType('test', 1000);

        const MockGomboc = await ethers.getContractFactory("MockGomboc");
        const mockGomboc = await MockGomboc.deploy();
        await mockGomboc.deployed();
        await gombocController.addGomboc(mockGomboc.address, 0, 10000);

        const MockGombocV2 = await ethers.getContractFactory("MockGombocV2");
        const mockGombocV2 = await MockGombocV2.deploy();
        await mockGombocV2.deployed();
        await gombocController.addGomboc(mockGombocV2.address, 0, 10000);

        const Minter = await ethers.getContractFactory("Minter");
        const minter = await Minter.deploy(eRC20LT.address, gombocController.address);
        await minter.deployed();

        await eRC20LT.setMinter(minter.address);

        return { eRC20LT, gombocController, minter, mockGomboc, mockGombocV2, owner, otherAccount };
    }


    describe("Minter", async function () {

        it("should revert right error when gomboc invalid", async function () {

            const { eRC20LT, minter, mockGomboc, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            await expect(minter.connect(otherAccount).mint(eRC20LT.address)).to.revertedWith("CE000")
        });

        it("mint", async function () {

            const { eRC20LT, minter, mockGomboc, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(0);
            await expect(await minter.connect(otherAccount).mint(mockGomboc.address)).to.emit(minter, "Minted").withArgs(otherAccount.address, mockGomboc.address, ethers.utils.parseEther("100"));
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGomboc.address)).to.equal(ethers.utils.parseEther("100"));

            await minter.connect(otherAccount).mint(mockGomboc.address);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGomboc.address)).to.equal(ethers.utils.parseEther("100"));
        });


        it("mint many", async function () {

            const { eRC20LT, minter, mockGomboc, mockGombocV2, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            await minter.connect(otherAccount).mintMany([mockGomboc.address, mockGombocV2.address, ethers.constants.AddressZero]);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("200"));
            expect(await minter.minted(otherAccount.address, mockGomboc.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGombocV2.address)).to.equal(ethers.utils.parseEther("100"));

            await minter.connect(otherAccount).mintMany([mockGombocV2.address]);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("300"));
            expect(await minter.minted(otherAccount.address, mockGombocV2.address)).to.equal(ethers.utils.parseEther("200"));
        });

        it("mint for", async function () {

            const { eRC20LT, minter, mockGomboc, mockGombocV2, owner, otherAccount } = await loadFixture(deployOneYearLockFixture);
            await minter.mintFor(mockGombocV2.address, otherAccount.address);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("0"));
            expect(await minter.minted(otherAccount.address, mockGombocV2.address)).to.equal(ethers.utils.parseEther("0"));

            await minter.connect(otherAccount).toggleApproveMint(owner.address);
            await minter.mintFor(mockGombocV2.address, otherAccount.address);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGombocV2.address)).to.equal(ethers.utils.parseEther("100"));

            await minter.connect(otherAccount).toggleApproveMint(owner.address);
            await minter.mintFor(mockGombocV2.address, otherAccount.address);
            expect(await eRC20LT.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("100"));
            expect(await minter.minted(otherAccount.address, mockGombocV2.address)).to.equal(ethers.utils.parseEther("100"));
        });


    })




})