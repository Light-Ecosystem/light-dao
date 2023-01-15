import { ethers } from "hardhat";
import { expect } from 'chai';
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("RestrictedList", () => {

    async function deployRestrictedListFixture() {
        const [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
        const RestrictedList = await ethers.getContractFactory("RestrictedList");
        const restrictedList = await RestrictedList.deploy();
        console.log("RestrictedList deploy address: ", restrictedList.address);
        return { owner, addr1, addr2, addr3, restrictedList }
    }

    describe("RestrictedList Address", async () => {
        // it("initialize hopetoken", async () => {
        //     const { owner, restrictedList } = await loadFixture(deployRestrictedListFixture);
        //     await restrictedList.initialize();
        //     expect(await restrictedList.owner()).to.equal(owner.address);
        // })
        it("add restrictedList address", async () => {
            const { addr3, restrictedList } = await loadFixture(deployRestrictedListFixture);
            // restrictedList.initialize()
            expect(await restrictedList.getRestrictedListStatus(addr3.address)).to.be.false;
            await expect(restrictedList.addRestrictedList(addr3.address)).to.be.emit(restrictedList, "AddedRestrictedList").withArgs(addr3.address);
            expect(await restrictedList.getRestrictedListStatus(addr3.address)).to.be.true;
        })
        it("remove restrictedList address", async () => {
            const { addr3, restrictedList } = await loadFixture(deployRestrictedListFixture);
            // restrictedList.initialize()
            await restrictedList.addRestrictedList(addr3.address);
            expect(await restrictedList.getRestrictedListStatus(addr3.address)).to.be.true;
            await expect(restrictedList.removeRestrictedList(addr3.address)).to.be.emit(restrictedList, "RemovedRestrictedList").withArgs(addr3.address);
            expect(await restrictedList.getRestrictedListStatus(addr3.address)).to.be.false;
        })

    })
})
