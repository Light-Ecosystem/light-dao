import { ethers } from "hardhat";
import { expect } from 'chai';
import { time, mine, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("HOPETokenContract", () => {

    async function deployHOPEFixture() {
        const [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
        const RestrictedList = await ethers.getContractFactory("RestrictedList");
        const restrictedList = await RestrictedList.deploy();
        console.log("RestrictedList deploy address: ", restrictedList.address);

        const HOPEToken = await ethers.getContractFactory("HOPE");
        const hopeToken = await HOPEToken.deploy();
        await hopeToken.initialize(restrictedList.address);
        console.log("HOPEToken deploy address: ", hopeToken.address);

        const Admin = await ethers.getContractFactory("Admin");
        const admin = await Admin.deploy(hopeToken.address);
        console.log("Admin contract address: ", admin.address);

        const Admin2 = await ethers.getContractFactory("Admin");
        const admin2 = await Admin2.deploy(hopeToken.address);
        console.log("Admin2 contract address: ", admin2.address);

        return { owner, addr1, addr2, addr3, hopeToken, restrictedList, admin, admin2 }
    }

    describe("Mint And Burn", async () => {
        describe("Mint only Agent & Minable", async () => {
            it("should revert not have the Agent role", async () => {
                const { admin } = await loadFixture(deployHOPEFixture);
                await expect(admin.mint(admin.address, 10)).to.be.revertedWith("AG000");
            })
            it("should revert not have the Minable role", async () => {
                const { hopeToken, admin } = await loadFixture(deployHOPEFixture);
                await hopeToken.grantAgent(
                    admin.address,
                    10_000,
                    0,
                    1000,
                    false,
                    true
                );
                await expect(admin.mint(admin.address, 10)).to.be.revertedWith("AG002");
            })
            it("should revert restrictedList address", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                await restrictedList.addRestrictedList(admin.address);
                await hopeToken.grantAgent(
                    admin.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(admin.mint(admin.address, 10)).to.be.revertedWith("FA000");
            })
            it("should revert eoa address", async () => {
                const { owner, hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                await hopeToken.grantAgent(
                    owner.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.mint(owner.address, 10)).to.be.revertedWith("HO000");
            })
            it("should revert credit not enough", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    admin.address,
                    5,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(admin.mint(admin.address, 10)).to.be.revertedWith("AG004");
            })
            it("should revert not reach effective block", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                const effectiveBlock = await ethers.provider.getBlockNumber() + 1000;
                const expirationBlock = effectiveBlock + 1000;
                await hopeToken.grantAgent(
                    admin.address,
                    5,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                );
                await expect(admin.mint(admin.address, 5)).to.be.revertedWith("AG014");
            })
            it("should revert expired", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                const effectiveBlock = await ethers.provider.getBlockNumber();
                const expirationBlock = effectiveBlock + 1000;
                await hopeToken.grantAgent(
                    admin.address,
                    5,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                );
                await mine(2000);
                await expect(admin.mint(admin.address, 5)).to.be.revertedWith("AG011");
            })

            it("Mint", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                const CREDIT = 100;
                const MINT_AMOUNT = 10;
                await hopeToken.grantAgent(
                    admin.address,
                    CREDIT,
                    0,
                    1000,
                    true,
                    true
                );
                await admin.mint(admin.address, MINT_AMOUNT);
                expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
                expect(await hopeToken.balanceOf(admin.address)).to.equal(MINT_AMOUNT);
                expect(await hopeToken.getMaxCredit(admin.address)).to.equal(CREDIT);
                expect(await hopeToken.getRemainingCredit(admin.address)).to.equal(CREDIT - MINT_AMOUNT);
            })
        })
        describe("Burn only Agent & Burnable", async () => {
            it("should revert not have the Agent role", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                await expect(admin.burn(5)).to.be.revertedWith("AG000");
            })
            it("should revert not have the Burnable role", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    admin.address,
                    10_000,
                    0,
                    1000,
                    true,
                    false
                );
                await expect(admin.burn(5)).to.be.revertedWith("AG003");
            })
            it("should revert Balance not enough", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    admin.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(admin.burn(5)).to.be.revertedWith("ERC20: burn amount exceeds balance")
            })
            it("should revert not reach effctive block", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                let effectiveBlock = await ethers.provider.getBlockNumber();
                const expirationBlock = effectiveBlock + 2000;
                const CREDIT = 10;
                const MINT_AMOUNT = 9;
                const BURN_AMOUNT = 9;
                await hopeToken.grantAgent(
                    admin.address,
                    CREDIT,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                );
                await admin.mint(admin.address, MINT_AMOUNT);
                expect(await hopeToken.getMaxCredit(admin.address)).to.equal(CREDIT);
                expect(await hopeToken.getRemainingCredit(admin.address)).to.equal(CREDIT - MINT_AMOUNT);
                await hopeToken.changeEffectiveBlock(admin.address, effectiveBlock + 1000);
                await expect(admin.burn(BURN_AMOUNT)).to.be.revertedWith("AG014");
            })
            it("should revert expired", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                const effectiveBlock = await ethers.provider.getBlockNumber();
                const expirationBlock = effectiveBlock + 1000;
                const CREDIT = 10;
                const MINT_AMOUNT = 9;
                const BURN_AMOUNT = 9;
                await hopeToken.grantAgent(
                    admin.address,
                    CREDIT,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                );
                await admin.mint(admin.address, MINT_AMOUNT);
                expect(await hopeToken.getMaxCredit(admin.address)).to.equal(CREDIT);
                expect(await hopeToken.getRemainingCredit(admin.address)).to.equal(CREDIT - MINT_AMOUNT);
                await mine(2000);
                await expect(admin.burn(BURN_AMOUNT)).to.be.revertedWith("AG011");
            })
            it("burn", async () => {
                const { hopeToken, restrictedList, admin } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                const CREDIT = 10;
                const MINT_AMOUNT = 9;
                const BURN_AMOUNT = 9;
                await hopeToken.grantAgent(
                    admin.address,
                    CREDIT,
                    0,
                    1000,
                    true,
                    true
                );

                await admin.mint(admin.address, MINT_AMOUNT);
                expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT);
                expect(await hopeToken.getMaxCredit(admin.address)).to.equal(CREDIT);
                expect(await hopeToken.getRemainingCredit(admin.address)).to.equal(CREDIT - MINT_AMOUNT);
                await admin.burn(BURN_AMOUNT);
                expect(await hopeToken.totalSupply()).to.equal(0);
                expect(await hopeToken.balanceOf(admin.address)).to.equal(0);
                expect(await hopeToken.getMaxCredit(admin.address)).to.equal(CREDIT);
                expect(await hopeToken.getRemainingCredit(admin.address)).to.equal(CREDIT);
            })
            it("burn out of remaining credit", async () => {
                const { owner, hopeToken, restrictedList, admin, admin2 } = await loadFixture(deployHOPEFixture);
                hopeToken.initialize(restrictedList.address);
                const CREDIT = 10;
                const MINT_AMOUNT = 9;
                const BURN_AMOUNT = 9;
                await hopeToken.grantAgent(
                    admin.address,
                    CREDIT,
                    0,
                    1000,
                    true,
                    true
                );

                await hopeToken.grantAgent(
                    admin2.address,
                    CREDIT,
                    0,
                    1000,
                    true,
                    true
                );
                await admin2.mint(owner.address, MINT_AMOUNT);
                expect(await hopeToken.balanceOf(owner.address)).to.equal(MINT_AMOUNT);
                hopeToken.transfer(admin.address, MINT_AMOUNT);
                expect(await hopeToken.balanceOf(admin.address)).to.equal(MINT_AMOUNT);
                expect(await hopeToken.balanceOf(owner.address)).to.equal(0);

                await admin.mint(admin.address, MINT_AMOUNT);
                expect(await hopeToken.totalSupply()).to.equal(MINT_AMOUNT + MINT_AMOUNT);
                expect(await hopeToken.getMaxCredit(admin.address)).to.equal(CREDIT);
                expect(await hopeToken.getRemainingCredit(admin.address)).to.equal(CREDIT - MINT_AMOUNT);
                await admin.burn(BURN_AMOUNT + BURN_AMOUNT);
                expect(await hopeToken.totalSupply()).to.equal(0);
                expect(await hopeToken.balanceOf(admin.address)).to.equal(0);
                expect(await hopeToken.getMaxCredit(admin.address)).to.equal(CREDIT);
                expect(await hopeToken.getRemainingCredit(admin.address)).to.equal(CREDIT);
            })
        })
    })
    describe("Call Transfer After Adding RestrictedList Address", async () => {
        it("should revert restrictedList address", async () => {
            const { addr1, addr2, addr3, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
            await restrictedList.addRestrictedList(addr1.address);
            await restrictedList.addRestrictedList(addr3.address);
            await expect(hopeToken.connect(addr1).transfer(addr2.address, 10)).to.be.revertedWith("FA000");
            await expect(hopeToken.transferFrom(addr2.address, addr1.address, 10)).to.be.revertedWith("FA000");
            await expect(hopeToken.transferFrom(addr3.address, addr1.address, 10)).to.be.revertedWith("FA000");
        })
        it("transfer", async () => {
            const { owner, addr1, addr2, addr3, hopeToken, admin } = await loadFixture(deployHOPEFixture);
            await hopeToken.grantAgent(
                admin.address,
                10_000,
                0,
                1000,
                true,
                true
            );
            await admin.mint(owner.address, 1_000);
            await admin.mint(addr1.address, 100);
            await admin.mint(addr2.address, 200);
            await admin.mint(addr3.address, 300);
            expect(await hopeToken.totalSupply()).to.equal(1_600);

            await hopeToken.connect(addr1).transfer(addr2.address, 10);
            expect(await hopeToken.balanceOf(addr1.address)).to.equal(100 - 10);
            expect(await hopeToken.balanceOf(addr2.address)).to.equal(200 + 10);

            await hopeToken.connect(addr1).approve(owner.address, 1_000_000_000);
            await hopeToken.transferFrom(addr1.address, addr2.address, 10);
            expect(await hopeToken.balanceOf(addr1.address)).to.equal(100 - 10 - 10);
            expect(await hopeToken.balanceOf(addr2.address)).to.equal(200 + 10 + 10);
        })
    })

})