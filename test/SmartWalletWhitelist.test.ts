import { ethers } from "hardhat";
import { expect } from 'chai';
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("SmartWalletWhitelist", () => {

    async function deployRestrictedListFixture() {
        const [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
        const SmartWalletWhitelist = await ethers.getContractFactory("SmartWalletWhitelist");
        const smartWalletWhitelist = await SmartWalletWhitelist.deploy();

        const smartWalletWhitelist_new = await SmartWalletWhitelist.deploy();

        return { owner, addr1, addr2, addr3, smartWalletWhitelist, smartWalletWhitelist_new }
    }

    describe("setChecker", async () => {

        it("commitSetChecker", async () => {

            const { owner, addr3, smartWalletWhitelist, smartWalletWhitelist_new } = await loadFixture(deployRestrictedListFixture);
            await smartWalletWhitelist.commitSetChecker(smartWalletWhitelist_new.address);
            expect(await smartWalletWhitelist.future_checker()).to.be.equal(smartWalletWhitelist_new.address);
        })

        it("applySetChecker", async () => {
            const { owner, addr3, smartWalletWhitelist, smartWalletWhitelist_new } = await loadFixture(deployRestrictedListFixture);
            await smartWalletWhitelist.commitSetChecker(smartWalletWhitelist_new.address);
            expect(await smartWalletWhitelist.future_checker()).to.be.equal(smartWalletWhitelist_new.address);
            await smartWalletWhitelist.applySetChecker();
            expect(await smartWalletWhitelist.checker()).to.be.equal(smartWalletWhitelist_new.address);
        })

        it("applySetChecker && check", async () => {
            const { owner, addr3, smartWalletWhitelist, smartWalletWhitelist_new } = await loadFixture(deployRestrictedListFixture);
            await smartWalletWhitelist.commitSetChecker(smartWalletWhitelist_new.address);
            expect(await smartWalletWhitelist.future_checker()).to.be.equal(smartWalletWhitelist_new.address);
            await smartWalletWhitelist.applySetChecker();
            expect(await smartWalletWhitelist.checker()).to.be.equal(smartWalletWhitelist_new.address);

            expect(await smartWalletWhitelist.check(addr3.address)).to.be.false;
            await smartWalletWhitelist_new.approveWallet(addr3.address);
            expect(await smartWalletWhitelist.check(addr3.address)).to.be.true;
        })

    })

    describe("approveWallet && check", async () => {

        it("approveWallet", async () => {
            const { owner, addr3, smartWalletWhitelist } = await loadFixture(deployRestrictedListFixture);
            expect(await smartWalletWhitelist.check(addr3.address)).to.be.false;
            await expect(smartWalletWhitelist.approveWallet(addr3.address)).to.be.emit(smartWalletWhitelist, "ApproveWallet").withArgs(addr3.address);
            expect(await smartWalletWhitelist.check(addr3.address)).to.be.true;
        })

        it("revokeWallet", async () => {
            const { owner, addr3, smartWalletWhitelist } = await loadFixture(deployRestrictedListFixture);
            await smartWalletWhitelist.approveWallet(addr3.address);
            expect(await smartWalletWhitelist.check(addr3.address)).to.be.true;
            await expect(smartWalletWhitelist.revokeWallet(addr3.address)).to.be.emit(smartWalletWhitelist, "RevokeWallet").withArgs(addr3.address);
            expect(await smartWalletWhitelist.check(addr3.address)).to.be.false;
        })

    })
})