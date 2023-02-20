import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { PermitSigHelper } from "../PermitSigHelper";
const { BigNumber } = require("ethers");

describe("ConnetVaultOfStHOPE", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployOneYearLockFixture() {

        // Contracts are deployed using the first signer/account by default
        const [owner, alice, bob] = await ethers.getSigners();

        const Permit2Contract = await ethers.getContractFactory("Permit2");
        const permit2 = await Permit2Contract.deploy();

        const RestrictedList = await ethers.getContractFactory("RestrictedList");
        const restrictedList = await RestrictedList.deploy();

        const HOPEToken = await ethers.getContractFactory("HOPE");
        const hopeToken = await upgrades.deployProxy(HOPEToken, [restrictedList.address]);
        await hopeToken.deployed();
        await hopeToken.approve(permit2.address, ethers.constants.MaxUint256);

        const Admin = await ethers.getContractFactory("Admin");
        const admin = await Admin.deploy(hopeToken.address);
        let MINT_AMOUNT = ethers.utils.parseEther("100000000");
        const effectiveBlock = await ethers.provider.getBlockNumber();
        const expirationBlock = effectiveBlock + 10000;
        await hopeToken.grantAgent(admin.address, MINT_AMOUNT, effectiveBlock, expirationBlock, true, true);
        await admin.mint(alice.address, ethers.utils.parseEther("1000"));

        const MockConnet = await ethers.getContractFactory("MockConnet");
        const mockConnet = await MockConnet.deploy();

        const LT = await ethers.getContractFactory("LT");
        const lt = await upgrades.deployProxy(LT, ["LT Dao Token", "LT"]);
        await lt.deployed();

        await time.increase(86400);
        await lt.updateMiningParameters();
        await lt.approve(permit2.address, ethers.constants.MaxUint256);

        const VeLT = await ethers.getContractFactory("VotingEscrow");
        const veLT = await VeLT.deploy(lt.address, permit2.address);
        await veLT.deployed();

        const GombocController = await ethers.getContractFactory("GombocController");
        const gombocController = await GombocController.deploy(lt.address, veLT.address);
        await gombocController.deployed();

        // console.log("hopeToken:", hopeToken.address);
        const Minter = await ethers.getContractFactory("Minter");
        const minter = await Minter.deploy(lt.address, gombocController.address);
        await minter.deployed();
        await lt.setMinter(minter.address);

        const StakingHOPE = await ethers.getContractFactory("StakingHOPE");
        const stakingHope = await StakingHOPE.deploy(hopeToken.address, minter.address, permit2.address);
        await stakingHope.deployed();

        let typeId = await gombocController.nGombocTypes();
        let weight = ethers.utils.parseEther("1");
        let gombocWeight = ethers.utils.parseEther("1");
        await gombocController.addType("stLiquidity", BigNumber.from(0));
        await gombocController.changeTypeWeight(typeId, weight);
        await gombocController.addGomboc(stakingHope.address, typeId, gombocWeight);

        let adminRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("withraw_Admin_Role"));

        const ConnetVaultOfStHOPE = await ethers.getContractFactory("ConnetVaultOfStHOPE");
        const connetVaultOfStHOPE = await upgrades.deployProxy(ConnetVaultOfStHOPE, [permit2.address, stakingHope.address, mockConnet.address, alice.address, owner.address, minter.address, lt.address]);
        await connetVaultOfStHOPE.deployed();
        await mockConnet.setValut(connetVaultOfStHOPE.address);

        return { owner, alice, bob, connetVaultOfStHOPE, permit2, hopeToken, stakingHope, mockConnet, admin, adminRole, gombocController, lt, veLT, minter };
    }

    describe("Initialize check", async function () {

        it("Initialize check", async function () {
            const { owner, alice, bob, connetVaultOfStHOPE, adminRole } = await loadFixture(deployOneYearLockFixture);
            expect(await connetVaultOfStHOPE.owner()).to.be.equal(owner.address);
            expect(await connetVaultOfStHOPE.hasRole(adminRole, alice.address)).to.true;
        });
    })

    describe("transferLTRewards", async function () {

        it("should revert right error when lt token is zero", async function () {
            const { owner, alice, bob, connetVaultOfStHOPE, adminRole } = await loadFixture(deployOneYearLockFixture);
            await expect(connetVaultOfStHOPE.transferLTRewards(bob.address, BigNumber.from("100"))).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("transferLTRewards", async function () {
            const { owner, alice, bob, connetVaultOfStHOPE, mockConnet, adminRole, hopeToken, stakingHope, permit2, lt } = await loadFixture(deployOneYearLockFixture);

            //staking hope
            let stakingAmount = ethers.utils.parseEther("100");
            await hopeToken.connect(alice).approve(stakingHope.address, stakingAmount);
            await stakingHope.connect(alice).staking(stakingAmount, ethers.constants.Zero, ethers.constants.Zero, "0x");

            let amount = ethers.utils.parseEther("10");
            await stakingHope.connect(alice).approve(connetVaultOfStHOPE.address, amount);
            await connetVaultOfStHOPE.connect(alice).deposit(amount, ethers.constants.Zero, ethers.constants.Zero, "0x");

            expect(await lt.balanceOf(mockConnet.address)).to.be.equal(0);
            await time.increase(86400 * 10);
            await mockConnet.setLt(lt.address);
            await connetVaultOfStHOPE.transferLTRewards(bob.address, ethers.utils.parseEther("1000"));
            expect(await lt.balanceOf(bob.address)).to.be.equal(ethers.utils.parseEther("1000"));
        });
    })

})