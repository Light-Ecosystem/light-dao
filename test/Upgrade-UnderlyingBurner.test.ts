import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { PermitSigHelper } from "./PermitSigHelper";
import { BigNumber } from "ethers";

describe("Upgrade UnderlyingBurner", function () {

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
        const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
        const GaugeFeeDistributor = await ethers.getContractFactory("GaugeFeeDistributor");
        const UnderlyingBurner = await ethers.getContractFactory("UnderlyingBurner");
        const UnderlyingBurnerV2 = await ethers.getContractFactory("UnderlyingBurnerV2");

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

        //deploy gaugeFeeDistributor contract
        const gaugeFeeDistributor = await upgrades.deployProxy(GaugeFeeDistributor, [gaugeController.address, startTime, hopeToken.address, stakingHope.address, bob.address]);
        await gaugeFeeDistributor.deployed();

        //deploy UnderlyingBurner
        const underlyingBurner = await upgrades.deployProxy(UnderlyingBurner, [hopeToken.address, feeDistributor.address, gaugeFeeDistributor.address, bob.address]);
        await underlyingBurner.deployed();
        const impV1 = await upgrades.erc1967.getImplementationAddress(underlyingBurner.address);

        // upgrade UnderlyingBurner
        await upgrades.upgradeProxy(underlyingBurner.address, UnderlyingBurnerV2);
        const impV2 = await upgrades.erc1967.getImplementationAddress(underlyingBurner.address);
        console.log(impV1, impV2);

        const WEEK = 7 * 86400;
        const MAXTIME = 4 * 365 * 86400;
        return { owner, alice, bob, hopeToken, stakingHope, lt, veLT, permit2, feeDistributor, gaugeFeeDistributor, underlyingBurner, WEEK, MAXTIME }
    }

    describe("transferHopeToFeeDistributor", async function () {

        it("should revert right error when contract pause", async function () {
            const { owner, alice, bob, underlyingBurner, hopeToken, stakingHope, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await underlyingBurner.pause();
            await expect(underlyingBurner.transferHopeToFeeDistributor()).to.rejectedWith("Pausable: paused");
        })

        it("should revert right error when insufficient balance", async function () {
            const { owner, alice, bob, underlyingBurner, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await expect(underlyingBurner.transferHopeToFeeDistributor()).to.revertedWith("insufficient balance");
        })

        it("transferHopeToFeeDistributor success", async function () {
            const { owner, alice, bob, underlyingBurner, hopeToken, feeDistributor, gaugeFeeDistributor, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);

            await hopeToken.transfer(underlyingBurner.address, ethers.utils.parseEther("100"));
            await underlyingBurner.transferHopeToFeeDistributor();
            expect(await hopeToken.balanceOf(feeDistributor.address)).to.be.equal(ethers.utils.parseEther("50"));
            expect(await hopeToken.balanceOf(gaugeFeeDistributor.address)).to.be.equal(ethers.utils.parseEther("50"));
        })
    })

    describe("recoverBalance", async function () {

        it("should revert right error when call recoverBalance if caller is not owner", async function () {
            const { owner, alice, bob, underlyingBurner, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await expect(underlyingBurner.connect(alice).recoverBalance(hopeToken.address)).to.rejectedWith("Ownable: caller is not the owner");
        })

        it("recoverBalance success", async function () {
            const { owner, alice, bob, underlyingBurner, hopeToken, WEEK, veLT, lt, permit2, MAXTIME } = await loadFixture(deployOneYearLockFixture);
            await hopeToken.transfer(underlyingBurner.address, ethers.utils.parseEther("100"));

            await underlyingBurner.setEmergencyReturn(alice.address);
            let balance = await hopeToken.balanceOf(underlyingBurner.address);
            await underlyingBurner.recoverBalance(hopeToken.address);
            expect(await hopeToken.balanceOf(alice.address)).to.be.equal(balance);
            expect(await hopeToken.balanceOf(underlyingBurner.address)).to.be.equal(0);

        })
    })

})