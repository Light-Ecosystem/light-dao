import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("BurnerManager", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, alice, bob] = await ethers.getSigners();


        const BurnerManager = await ethers.getContractFactory("BurnerManager");
        const burnerManager = await BurnerManager.deploy();
        await burnerManager.deployed();

        return { owner, alice, bob, burnerManager };
    }

    describe("setBurner", async function () {

        it("should revert right error when caller is not the owner", async function () {

            const { owner, alice, bob, burnerManager } = await loadFixture(deployOneYearLockFixture);
            await expect(burnerManager.connect(bob).setBurner(owner.address, alice.address)).to.revertedWith("Ownable: caller is not the owner")
        });

        it("should revert right error when invalid address", async function () {

            const { owner, alice, bob, burnerManager } = await loadFixture(deployOneYearLockFixture);
            await expect(burnerManager.setBurner(ethers.constants.AddressZero, alice.address)).to.revertedWith("CE000")
            await expect(burnerManager.setBurner(alice.address, ethers.constants.AddressZero)).to.revertedWith("CE000")
        });

        it("setBurner success", async function () {

            const { owner, alice, bob, burnerManager } = await loadFixture(deployOneYearLockFixture);
            await expect(await burnerManager.setBurner(owner.address, alice.address)).to.emit(burnerManager, "AddBurner").withArgs(alice.address, ethers.constants.AddressZero);
            expect(await burnerManager.burners(owner.address)).to.be.equal(alice.address);
        });

    })

    describe("setManyBurner", async function () {

        it("should revert right error when caller is not the owner", async function () {

            const { owner, alice, bob, burnerManager } = await loadFixture(deployOneYearLockFixture);
            await expect(burnerManager.connect(bob).setManyBurner([owner.address], [alice.address])).to.revertedWith("Ownable: caller is not the owner")
        });

        it("should revert right error when invalid address", async function () {

            const { owner, alice, bob, burnerManager } = await loadFixture(deployOneYearLockFixture);
            await expect(burnerManager.setManyBurner([ethers.constants.AddressZero], [alice.address])).to.revertedWith("CE000")
            await expect(burnerManager.setManyBurner([alice.address], [ethers.constants.AddressZero])).to.revertedWith("CE000")
        });

        it("should revert right error when invalid param", async function () {

            const { owner, alice, bob, burnerManager } = await loadFixture(deployOneYearLockFixture);
            await expect(burnerManager.setManyBurner([ethers.constants.AddressZero, alice.address], [alice.address])).to.revertedWith("invalid param")
        });

        it("setManyBurner success", async function () {

            const { owner, alice, bob, burnerManager } = await loadFixture(deployOneYearLockFixture);
            await expect(await burnerManager.setManyBurner([owner.address, alice.address], [alice.address, owner.address])).to.emit(burnerManager, "AddBurner").withArgs(alice.address, ethers.constants.AddressZero);
            expect(await burnerManager.burners(owner.address)).to.be.equal(alice.address);
            expect(await burnerManager.burners(alice.address)).to.be.equal(owner.address);
        });

    })

})