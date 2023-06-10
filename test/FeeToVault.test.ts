import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000001";


describe("FeeToVault", function () {
    async function fixture() {
        const MockHOPE = await ethers.getContractFactory("MockLP");
        const HOPE = await MockHOPE.deploy("MockHOPE", "HOPE", 18, 1000000);
        await HOPE.deployed();

        //deploy UnderlyingBurner
        const UnderlyingBurner = await ethers.getContractFactory("UnderlyingBurner");
        const underlyingBurner = await upgrades.deployProxy(UnderlyingBurner, [HOPE.address, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS]);
        await underlyingBurner.deployed();

        const BurnerManager = await ethers.getContractFactory("BurnerManager");
        const burnerManager = await BurnerManager.deploy();
        await burnerManager.deployed();

        const FeeToVault = await ethers.getContractFactory("FeeToVault");
        const feeToVault = await upgrades.deployProxy(FeeToVault, [burnerManager.address, underlyingBurner.address]);
        await feeToVault.deployed();

        const HopeSwapBurner = await ethers.getContractFactory("HopeSwapBurner");
        const hopeSwapBurner = await HopeSwapBurner.deploy(HOPE.address, feeToVault.address);
        await hopeSwapBurner.deployed();

        // set burner for HOPE
        await burnerManager.setBurner(HOPE.address, hopeSwapBurner.address);
    
        const [owner,] = await ethers.getSigners();
        return { owner, HOPE, feeToVault, underlyingBurner, burnerManager, hopeSwapBurner };
    }

    it("HOPE should be burn right", async () => {
        const { owner, HOPE, feeToVault, underlyingBurner } = await loadFixture(fixture); 
        await HOPE.transfer(feeToVault.address, 10000);

        await feeToVault.addOperator(owner.address);
        await feeToVault.burn(HOPE.address, 10000, 0);

        let expectedbalance = await HOPE.balanceOf(underlyingBurner.address);
        expect(expectedbalance).to.be.gt(0);
    });
});