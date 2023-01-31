import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { PermitSigHelper } from "./PermitSigHelper";
import { time, mine, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";

describe("TokenhopeSalesAgent", function () {

    const TOTAL_SUPPLY = 2_000_000_000;

    async function deploySaleFixture() {
        const [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        const RestrictedList = await ethers.getContractFactory("RestrictedList");
        const restrictedList = await RestrictedList.deploy();
        console.log("RestrictedList contract address: ", restrictedList.address);

        const HOPEToken = await ethers.getContractFactory("HOPE");
        const hopeToken = await upgrades.deployProxy(HOPEToken, [restrictedList.address]);
        await hopeToken.deployed();
        console.log("HOPE contract address: ", hopeToken.address);

        const Permit2Contract = await ethers.getContractFactory("Permit2");
        const permit2 = await Permit2Contract.deploy();
        console.log("Permit2 contract address: ", permit2.address);

        const HOPESalesAgent = await ethers.getContractFactory("HOPESalesAgent");
        const hopeSalesAgent = await HOPESalesAgent.deploy(hopeToken.address, permit2.address);
        console.log("Sale contract address: ", hopeSalesAgent.address);

        const UsdtToken = await ethers.getContractFactory("MyToken");
        const usdtToken = await UsdtToken.deploy();
        usdtToken.initialize("Tether USDT", "USDT", TOTAL_SUPPLY, 6);
        console.log("USDT contract address: ", usdtToken.address);

        const UsdcToken = await ethers.getContractFactory("MyToken");
        const usdcToken = await UsdcToken.deploy();
        usdcToken.initialize("USD Coin", "USDC", TOTAL_SUPPLY, 18);
        console.log("USDC contract address: ", usdcToken.address);

        const DaiToken = await ethers.getContractFactory("MyToken");
        const daiToken = await DaiToken.deploy();
        usdcToken.initialize("DAI", "DAI", TOTAL_SUPPLY, 18);
        console.log("DAI contract address: ", daiToken.address);
        return { owner, addr1, addr2, hopeToken, hopeSalesAgent, permit2, usdtToken, usdcToken };
    }

    describe("Add Currency", async () => {
        it("should revert the currency is already exist", async () => {
            const { hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await expect(hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000)).to.be.revertedWith("HS002")
        })
        it("should revert rate must greater than zero", async () => {
            const { hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await expect(hopeSalesAgent.addCurrency("USDT", usdtToken.address, 0)).to.be.revertedWith("HS003");
        })
        it("should revert invalid token address", async () => {
            const { hopeSalesAgent } = await loadFixture(deploySaleFixture);
            await expect(hopeSalesAgent.addCurrency("USDT", ethers.constants.AddressZero, 2000)).to.be.revertedWith("CE000");
        })
        it("should revert different from contract symbol", async () => {
            const { hopeSalesAgent, usdcToken } = await loadFixture(deploySaleFixture);
            await expect(hopeSalesAgent.addCurrency("USDT", usdcToken.address, 2000)).to.be.revertedWith("HS004")
        })
        it("add currency", async () => {
            const { hopeSalesAgent, usdtToken, usdcToken } = await loadFixture(deploySaleFixture);
            await expect(hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000)).to.be.emit(hopeSalesAgent, "AddCurrency").withArgs("USDT", usdtToken.address, 2000);
            await expect(hopeSalesAgent.addCurrency("USDC", usdcToken.address, 1000)).to.be.emit(hopeSalesAgent, "AddCurrency").withArgs("USDC", usdcToken.address, 1000);
            expect((await hopeSalesAgent.currencys("USDT")).symbol).to.be.equal("USDT");
            expect((await hopeSalesAgent.currencys("USDT")).token).to.be.equal(usdtToken.address);
            expect((await hopeSalesAgent.currencys("USDT")).rate).to.be.equal(2000);
            expect((await hopeSalesAgent.currencys("USDC")).symbol).to.be.equal("USDC");
            expect((await hopeSalesAgent.currencys("USDC")).token).to.be.equal(usdcToken.address);
            expect((await hopeSalesAgent.currencys("USDC")).rate).to.be.equal(1000);
        })

    })

    describe("Change Currency Rate", async () => {
        it("should revert invalid symbol", async () => {
            const { hopeSalesAgent } = await loadFixture(deploySaleFixture);
            await expect(hopeSalesAgent.changeCurrencyRate("UUU", 1000)).to.be.revertedWith("CE001");
        })
        it("should revert rate must greater than zero", async () => {
            const { hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await expect(hopeSalesAgent.changeCurrencyRate("USDT", 0)).to.be.revertedWith("HS003");
        })
        it("change currency rate", async () => {
            const { hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await expect(hopeSalesAgent.changeCurrencyRate("USDT", 3000)).to.be.emit(hopeSalesAgent, "ChangeCurrencyRate").withArgs("USDT", 3000, 2000);
            expect((await hopeSalesAgent.currencys("USDT")).rate).to.be.equal(3000);
        })
    })

    describe("Delete Currency", async () => {
        it("should revert invalid symbol", async () => {
            const { hopeSalesAgent } = await loadFixture(deploySaleFixture);
            await expect(hopeSalesAgent.deleteCurrency("USDT")).to.be.revertedWith("CE001");
        })
        it("should revert redeem balance before delete the currency", async () => {
            const { hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await usdtToken.transfer(hopeSalesAgent.address, 100);
            expect(await usdtToken.balanceOf(hopeSalesAgent.address)).to.be.equal(100);
            await expect(hopeSalesAgent.deleteCurrency("USDT")).to.be.revertedWith("HS005");
        })
        it("delete currency", async () => {
            const { hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await expect(hopeSalesAgent.deleteCurrency("USDT")).to.be.emit(hopeSalesAgent, "DeleteCurrency").withArgs("USDT");
        })
    })

    describe("Balance Of", async () => {
        it("return zero if address is zero", async () => {
            const { hopeSalesAgent } = await loadFixture(deploySaleFixture);
            expect(await hopeSalesAgent.balanceOf(ethers.constants.AddressZero)).to.be.equal(0);
        })
        it("balance of", async () => {
            const { hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await usdtToken.transfer(hopeSalesAgent.address, 100);
            expect(await hopeSalesAgent.balanceOf("USDT")).to.be.equal(100);
        })
    })

    describe("Buy", async () => {
        it("should revert unsupport currency", async () => {
            const { permit2, owner, hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(100), NONCE, DEADLINE);
            await expect(hopeSalesAgent.buy("USDT", 100, NONCE, DEADLINE, sig)).to.be.revertedWith("HS000");
        })
        it("should revert the minimum purchase quota cannot be reached", async () => {
            const { permit2, owner, hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(0), NONCE, DEADLINE);
            await expect(hopeSalesAgent.buy("USDT", 0, NONCE, DEADLINE, sig)).to.be.revertedWith("HS001");
        })
        it("should revert out of credit", async () => {
            const { permit2, owner, hopeToken, hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await hopeToken.grantAgent(
                hopeSalesAgent.address,
                10,
                0,
                1000,
                true,
                true
            );
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(100), NONCE, DEADLINE);
            await expect(hopeSalesAgent.buy("USDT", 100, NONCE, DEADLINE, sig)).to.be.revertedWith("AG004");
        })
        it("should revert insufficient allowance", async () => {
            const { permit2, owner, hopeToken, hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await hopeToken.grantAgent(
                hopeSalesAgent.address,
                10_000,
                0,
                1000,
                true,
                true
            );
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(5000), NONCE, DEADLINE);
            await expect(hopeSalesAgent.buy("USDT", 5_000, NONCE, DEADLINE, sig)).to.be.revertedWith("TRANSFER_FROM_FAILED");
        })
        it("should return zero when not reach effective time", async () => {
            const { permit2, owner, hopeToken, hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            const effectiveBlock = await ethers.provider.getBlockNumber() + 1000;
            const expirationBlock = effectiveBlock + 1000;
            await hopeToken.grantAgent(
                hopeSalesAgent.address,
                10_000,
                effectiveBlock,
                expirationBlock,
                true,
                true
            );
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(5000), NONCE, DEADLINE);
            await expect(hopeSalesAgent.buy("USDT", 5_000, NONCE, DEADLINE, sig)).to.be.revertedWith("AG004");
        })
        it("should return zero when greater than expiration time", async () => {
            const { permit2, owner, hopeToken, hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            const effectiveBlock = await ethers.provider.getBlockNumber();
            const expirationBlock = effectiveBlock + 1000;
            await hopeToken.grantAgent(
                hopeSalesAgent.address,
                10_000,
                effectiveBlock,
                expirationBlock,
                true,
                true
            );
            await mine(2000);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(5000), NONCE, DEADLINE);
            await expect(hopeSalesAgent.buy("USDT", 5_000, NONCE, DEADLINE, sig)).to.be.revertedWith("AG004");
        })
        it("buy USDT", async () => {
            const { permit2, owner, hopeToken, hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await hopeToken.grantAgent(
                hopeSalesAgent.address,
                10_000,
                0,
                1000,
                true,
                true
            );
            hopeSalesAgent.on("Buy", (_fromCurrency, _buyer, _fromValue, _toValue, _blockStamp) => {
                console.log('Buy Event: ', _fromCurrency, _buyer, _fromValue, _toValue, _blockStamp);
            });
            await usdtToken.approve(permit2.address, 10_000_000_000);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig1 = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(1000), NONCE, DEADLINE);
            await expect(hopeSalesAgent.buy("USDT", 1_000, NONCE, DEADLINE, sig1)).emit(hopeSalesAgent, "Buy")
                .withArgs("USDT", owner.address, 1_000, 2_000, anyValue);
            random = ethers.utils.randomBytes(32);
            NONCE = BigNumber.from(random);
            const sig2 = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(1000), NONCE, DEADLINE);
            await hopeSalesAgent.buy("USDT", 1_000, NONCE, DEADLINE, sig2);
            expect(await usdtToken.balanceOf(owner.address)).to.be.equal(TOTAL_SUPPLY - 2_000);
            expect(await usdtToken.balanceOf(hopeSalesAgent.address)).to.be.eq(2_000);
            expect(await hopeToken.balanceOf(owner.address)).to.be.equal(4_000);
            expect(await hopeToken.getMaxCredit(hopeSalesAgent.address)).to.be.equal(10_000);
            expect(await hopeToken.getRemainingCredit(hopeSalesAgent.address)).to.be.equal(6_000);
            expect(await hopeSalesAgent.remainingCredit()).to.be.equal(6_000);
            // await new Promise(res => setTimeout(() => res(null), 5000));
        })
        it("buy USDC", async () => {
            const { permit2, addr1, hopeToken, hopeSalesAgent, usdcToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDC", usdcToken.address, 1000);
            await hopeToken.grantAgent(
                hopeSalesAgent.address,
                10_000,
                0,
                1000,
                true,
                true
            );
            await usdcToken.transfer(addr1.address, 2_000);
            hopeSalesAgent.on("Buy", (_fromCurrency, _buyer, _fromValue, _toValue, _blockStamp) => {
                console.log('Buy Event: ', _fromCurrency, _buyer, _fromValue, _toValue, _blockStamp);
            });
            await usdcToken.connect(addr1).approve(permit2.address, 10_000_000_000);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(addr1, usdcToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(2000), NONCE, DEADLINE);
            await expect(hopeSalesAgent.connect(addr1).buy("USDC", 2_000, NONCE, DEADLINE, sig)).emit(hopeSalesAgent, "Buy")
                .withArgs("USDC", addr1.address, 2_000, 2_000, anyValue);
            expect(await usdcToken.balanceOf(addr1.address)).to.be.equal(0);
            expect(await usdcToken.balanceOf(hopeSalesAgent.address)).to.be.eq(2_000);
            expect(await hopeToken.balanceOf(addr1.address)).to.be.equal(2_000);
            expect(await hopeToken.getMaxCredit(hopeSalesAgent.address)).to.be.equal(10_000);
            expect(await hopeToken.getRemainingCredit(hopeSalesAgent.address)).to.be.equal(8_000);
            expect(await hopeSalesAgent.remainingCredit()).to.be.equal(8_000);
            // await new Promise(res => setTimeout(() => res(null), 5000));
        })
        it("should Pause", async () => {
            const { permit2, owner, usdtToken, hopeSalesAgent } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.pause();
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(1000), NONCE, DEADLINE);
            await expect(hopeSalesAgent.buy("USDT", 1_000, NONCE, DEADLINE, sig)).to.be.revertedWith("Pausable: paused");
        })
    })
    describe("Admin Redeem", async () => {
        it("should revert invalid symbol", async () => {
            const { owner, hopeSalesAgent } = await loadFixture(deploySaleFixture);
            await expect(hopeSalesAgent.redeem("USDT", owner.address, 100)).to.be.revertedWith("CE001");
        })
        it("should revert insufficient balance", async () => {
            const { owner, hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await expect(hopeSalesAgent.redeem("USDT", owner.address, 1)).to.be.revertedWith("CE002");
        })
        it("should Pause", async () => {
            const { permit2, owner, hopeSalesAgent, hopeToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.pause();
            await expect(hopeSalesAgent.redeem("USDT", owner.address, 1_000)).to.be.revertedWith("Pausable: paused");
            await hopeSalesAgent.unpause();
        })
        it("redeem", async () => {
            const { permit2, owner, addr1, hopeToken, hopeSalesAgent, usdtToken } = await loadFixture(deploySaleFixture);
            await hopeSalesAgent.addCurrency("USDT", usdtToken.address, 2000);
            await hopeToken.grantAgent(
                hopeSalesAgent.address,
                10_000,
                0,
                1000,
                true,
                true
            );
            hopeSalesAgent.on("Buy", (_fromCurrency, _buyer, _fromValue, _toValue, _blockStamp) => {
                console.log('Buy Event: ', _fromCurrency, _buyer, _fromValue, _toValue, _blockStamp);
            });
            await usdtToken.approve(permit2.address, 10_000_000_000);
            const DEADLINE = await time.latest() + 60 * 60;
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig1 = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(1000), NONCE, DEADLINE);
            await expect(hopeSalesAgent.buy("USDT", 1_000, NONCE, DEADLINE, sig1)).emit(hopeSalesAgent, "Buy")
                .withArgs("USDT", owner.address, 1_000, 2_000, anyValue);
            random = ethers.utils.randomBytes(32);
            NONCE = BigNumber.from(random);
            const sig2 = await PermitSigHelper.signature(owner, usdtToken.address, permit2.address, hopeSalesAgent.address, BigNumber.from(1000), NONCE, DEADLINE);
            await hopeSalesAgent.buy("USDT", 1_000, NONCE, DEADLINE, sig2);

            hopeSalesAgent.on("Redeem", (_symbol, _to, _amount) => {
                console.log("Redeem Event: ", _symbol, _to, _amount);
            });
            await expect(hopeSalesAgent.redeem("USDT", addr1.address, 2_000)).to.be.emit(hopeSalesAgent, "Redeem").withArgs("USDT", addr1.address, 2_000);
            expect(await usdtToken.balanceOf(addr1.address)).to.be.equal(2_000);
            expect(await usdtToken.balanceOf(hopeSalesAgent.address)).to.be.equal(0);
            await expect(hopeSalesAgent.deleteCurrency("USDT")).to.be.emit(hopeSalesAgent, "DeleteCurrency").withArgs("USDT");
            // await new Promise(res => setTimeout(() => res(null), 5000));
        })
    })
}); 