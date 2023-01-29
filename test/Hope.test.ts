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
        console.log("HOPEToken deploy address: ", hopeToken.address);

        return { owner, addr1, addr2, addr3, hopeToken, restrictedList }
    }

    describe("Initialize", () => {
        it("should revert invalid address", async () => {
            const { owner, hopeToken } = await loadFixture(deployHOPEFixture);
            await expect(hopeToken.initialize(ethers.constants.AddressZero)).revertedWith("CE000");
        })
        it("initialize hopetoken", async () => {
            const { owner, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
            await hopeToken.initialize(restrictedList.address);
            expect(await hopeToken.owner()).to.equal(owner.address);
        })
    })

    describe("Agent Role", () => {
        describe("Grant Role Data", async () => {
            it("should revert invalid address", async () => {
                const { hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.grantAgent(
                    ethers.constants.AddressZero,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                )).to.be.revertedWith("CE000");
            })
            it("should revert has alreay granted", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                )
                await expect(hopeToken.grantAgent(
                    addr1.address,
                    100_000,
                    0,
                    1000,
                    true,
                    true
                )).to.be.revertedWith("AG001")
            })
            it("should revert credit must greater than zero", async () => {
                const { owner, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.grantAgent(
                    owner.address,
                    0,
                    0,
                    1000,
                    true,
                    true
                )).to.be.revertedWith("AG005");
            })
            it("should revert expiration block greater than or equal now", async () => {
                const { owner, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await mine(1000);
                await expect(hopeToken.grantAgent(
                    owner.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                )).to.be.revertedWith("AG006");
            })
            it("should revert effctive block less than expiration block", async () => {
                const { owner, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                const effectiveBlock = await ethers.provider.getBlockNumber() + 1000;
                const expirationBlock = effectiveBlock;
                await expect(hopeToken.grantAgent(
                    owner.address,
                    10_000,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                )).to.be.revertedWith("AG015");
            })
            it("grant role data", async () => {
                const { owner, addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                hopeToken.on("AgentGranted", (account, credit, effectiveBlock, expirationBlock, minable, burnable, sender) => {
                    console.log("AgentGranted Event: ", account, credit, effectiveBlock, expirationBlock, minable, burnable, sender);
                })
                const effectiveBlock = await ethers.provider.getBlockNumber();
                const expirationBlock = effectiveBlock + 1000;
                await expect(hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                )).to.be.emit(hopeToken, "AgentGranted")
                    .withArgs(addr1.address, 10_000, effectiveBlock, expirationBlock, true, true, owner.address);
            })
        })
        describe("Revoked Role", async () => {
            it("should revert invalid address", async () => {
                const { hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.revokeAgent(ethers.constants.AddressZero)).rejectedWith("CE000");
            })
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.revokeAgent(addr1.address)).to.be.revertedWith("AG000");
            })
            it("Revoked Role", async () => {
                const { owner, addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                )
                await expect(hopeToken.revokeAgent(addr1.address)).to.be.emit(hopeToken, "AgentRevoked")
                    .withArgs(addr1.address, owner.address);
                expect(await hopeToken.hasAgent(addr1.address)).to.be.false;
            })
        })
        it("Has Agent Role", async () => {
            const { addr1, addr2, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
            await hopeToken.initialize(restrictedList.address);
            await hopeToken.grantAgent(
                addr1.address,
                10_000,
                0,
                1000,
                true,
                true
            );
            expect(await hopeToken.hasAgent(addr1.address)).to.be.true;
            expect(await hopeToken.hasAgent(addr2.address)).to.be.false;
        })
        describe("Get Agent Max Credit", async () => {
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.getMaxCredit(addr1.address)).to.be.revertedWith("AG000");
            })
            it("get max credit", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                expect(await hopeToken.getMaxCredit(addr1.address)).to.equal(10_000);
            })
        })
        describe("Get Agent Remaining Credit", async () => {
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.getRemainingCredit(addr1.address)).to.be.revertedWith("AG000");
            })
            it("should return zero when not reach effective block", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                const effectiveBlock = await ethers.provider.getBlockNumber() + 1000;
                const expirationBlock = effectiveBlock + 1000;
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                );
                expect(await hopeToken.getRemainingCredit(addr1.address)).to.equal(0);
            })
            it("should return zero when greater than expiration block", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                const effectiveBlock = await ethers.provider.getBlockNumber();
                const expirationBlock = effectiveBlock + 1000;
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                );
                await mine(2000);
                expect(await hopeToken.getRemainingCredit(addr1.address)).to.equal(0);
            })
            it("get remaining credit", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                expect(await hopeToken.getRemainingCredit(addr1.address)).to.equal(10_000);
            })
        })
        describe("Is Agent Minable", async () => {
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.isMinable(addr1.address)).to.be.revertedWith("AG000");
            })
            it("is minable", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                expect(await hopeToken.isMinable(addr1.address)).to.be.true;
            })
        })
        describe("Is Agent Burnable", async () => {
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.isBurnable(addr1.address)).to.be.revertedWith("AG000");
            })
            it("is burnable", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                expect(await hopeToken.isBurnable(addr1.address)).to.be.true;
            })
        })
        describe("Get Agent Effective Block", async () => {
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.getEffectiveBlock(addr1.address)).to.be.revertedWith("AG000");
            })
            it("get effective block", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                const effectiveBlock = await ethers.provider.getBlockNumber();
                const expirationBlock = await ethers.provider.getBlockNumber() + 1000;
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                );
                expect(await hopeToken.getEffectiveBlock(addr1.address)).to.equal(effectiveBlock);
            })
        })
        describe("Change Effective Block", async () => {
            it("should revert invalid address", async () => {
                const { hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.changeEffectiveBlock(ethers.constants.AddressZero, 0)).rejectedWith("CE000");
            })
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.changeEffectiveBlock(addr1.address, 0)).to.be.revertedWith("AG000");
            })
            it("should revert invalid effective block", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                const effectiveBlock = await ethers.provider.getBlockNumber();
                let expirationBlock = effectiveBlock + 1000;
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                );
                const afterEffectiveBlock = expirationBlock + 1
                await expect(hopeToken.changeEffectiveBlock(addr1.address, afterEffectiveBlock)).to.be.revertedWith("AG012");
            })
            it("change effective block", async () => {
                const { owner, addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                const effectiveBlock = await ethers.provider.getBlockNumber();
                let expirationBlock = effectiveBlock + 1000;
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    effectiveBlock,
                    expirationBlock,
                    true,
                    true
                );
                const afterEffectiveBlock = expirationBlock - 5;
                await expect(hopeToken.changeEffectiveBlock(addr1.address, afterEffectiveBlock)).to.be.emit(hopeToken, "AgentChangeEffectiveBlock")
                    .withArgs(addr1.address, afterEffectiveBlock, owner.address);
                expect(await hopeToken.getEffectiveBlock(addr1.address)).to.equal(afterEffectiveBlock);
            })
        })
        describe("Get Agent Expiration Block", async () => {
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.getExpirationBlock(addr1.address)).to.be.revertedWith("AG000");
            })
            it("get expiration block", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                expect(await hopeToken.getExpirationBlock(addr1.address)).to.equal(1000);
            })
        })
        describe("Change Expiration Block", async () => {
            it("should revert invalid address", async () => {
                const { hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.changeExpirationBlock(ethers.constants.AddressZero, 1000)).rejectedWith("CE000");
            })
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.changeExpirationBlock(addr1.address, 1000)).to.be.revertedWith("AG000");
            })
            it("should revert invalid expiration block", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.changeExpirationBlock(addr1.address, 1000)).to.be.revertedWith("AG013");
            })
            it("change expiration block", async () => {
                const { owner, addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.changeExpirationBlock(addr1.address, 2000)).to.be.emit(hopeToken, "AgentChangeExpirationBlock")
                    .withArgs(addr1.address, 2000, owner.address);
                expect(await hopeToken.getExpirationBlock(addr1.address)).to.equal(2000);
            })
        })

        describe("Switch Minable", async () => {
            it("should revert invalid address", async () => {
                const { hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.switchMinable(ethers.constants.AddressZero, false)).rejectedWith("CE000");
            })
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.switchMinable(addr1.address, true)).to.be.revertedWith("AG000");
            })
            it("should revert invalid minable", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.switchMinable(addr1.address, true)).to.be.revertedWith("AG010");
            })
            it("switch minable", async () => {
                const { owner, addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.switchMinable(addr1.address, false)).to.be.emit(hopeToken, "AgentSwitchMinable")
                    .withArgs(addr1.address, false, owner.address);
                expect(await hopeToken.isMinable(addr1.address)).to.be.false;
            })

        })
        describe("Switch Burnable", async () => {
            it("should revert invalid address", async () => {
                const { hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.switchBurnable(ethers.constants.AddressZero, false)).rejectedWith("CE000");
            })
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.switchBurnable(addr1.address, true)).to.be.revertedWith("AG000");
            })
            it("should revert invalid burnable", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.switchBurnable(addr1.address, true)).to.be.revertedWith("AG010");
            })
            it("switch burnable", async () => {
                const { owner, addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.switchBurnable(addr1.address, false)).to.be.emit(hopeToken, "AgentSwitchBurnable")
                    .withArgs(addr1.address, false, owner.address);
                expect(await hopeToken.isBurnable(addr1.address)).to.be.false;
            })
        })
        describe("Increase Credit", async () => {
            it("should revert invalid address", async () => {
                const { hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.increaseCredit(ethers.constants.AddressZero, 1)).revertedWith("CE000");
            })
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.increaseCredit(addr1.address, 1)).to.be.revertedWith("AG000");
            })
            it("should revert credit geater than zero", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.increaseCredit(addr1.address, 0)).to.be.revertedWith("AG007");
            })
            it("increase credit", async () => {
                const { owner, addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.increaseCredit(addr1.address, 1)).to.be.emit(hopeToken, "AgentIncreaseCredit")
                    .withArgs(addr1.address, 1, owner.address);
                expect(await hopeToken.getMaxCredit(addr1.address)).to.equal(10_001);
                expect(await hopeToken.getRemainingCredit(addr1.address)).to.equal(10_001);
            })
        })
        describe("Decrease Credit", async () => {
            it("should revert invalid address", async () => {
                const { hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.decreaseCredit(ethers.constants.AddressZero, 1)).revertedWith("CE000");
            })
            it("should revert account not has agent role", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await expect(hopeToken.decreaseCredit(addr1.address, 1)).to.be.revertedWith("AG000");
            })
            it("should revert credit geater than zero", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.decreaseCredit(addr1.address, 0)).to.be.revertedWith("AG008");
            })
            it("should revert credit <= remaining credit", async () => {
                const { addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.decreaseCredit(addr1.address, 10_001)).to.be.revertedWith("AG009");
            })
            it("decrease credit", async () => {
                const { owner, addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
                await hopeToken.initialize(restrictedList.address);
                await hopeToken.grantAgent(
                    addr1.address,
                    10_000,
                    0,
                    1000,
                    true,
                    true
                );
                await expect(hopeToken.decreaseCredit(addr1.address, 1)).to.be.emit(hopeToken, "AgentDecreaseCredit")
                    .withArgs(addr1.address, 1, owner.address);
                expect(await hopeToken.getMaxCredit(addr1.address)).to.equal(9_999);
                expect(await hopeToken.getRemainingCredit(addr1.address)).to.equal(9_999);
            })
        })
    })

    describe("Transferownership", async () => {
        it("Transferownership", async () => {
            const { owner, addr1, hopeToken, restrictedList } = await loadFixture(deployHOPEFixture);
            await hopeToken.initialize(restrictedList.address);
            expect(await hopeToken.owner()).to.equal(owner.address);
            await hopeToken.transferOwnership(addr1.address);
            expect(await hopeToken.pendingOwner()).to.equal(addr1.address);
            expect(await hopeToken.owner()).to.equal(owner.address);
            await hopeToken.connect(addr1).acceptOwnership();
            expect(await hopeToken.owner()).to.equal(addr1.address);
        })
    })

})