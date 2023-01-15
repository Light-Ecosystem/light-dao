import { ethers } from "hardhat";
import { PermitSigHelper } from "./PermitSigHelper";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("TokenhopeSalesAgent", function () {

    const TOTAL_SUPPLY = 2_000_000_000;
    const USDT_TOKEN = "0xFecF33C8FE7b5D4D61a09878a314C851C0E12cEE";
    const TOKEN_SALE = "0x06bcD6A663EEB9DAC2e528f623fAf98a01FFfA59";
    const PERMIT2 = "0xd8974D9d3a024bE5f046BeAcd977A0b827e646f6";
    const HOPE_TOKEN = "0x9EFebA540B233BA3fF944e12e0986D929065E978";
    const STAKING_HOPE = "0x62e7D3f4084d550A6C3dd3Dd93c2450112cb711e";
    const GOMBOC_CONTROLLER = "0x8b572C33f5bE40E58fEba084a6875a378c2db799";
    const LT_TOKEN = "0x521E97f0f53011dAE5D1d78AAfCE3a5C321FD188";
    const VE_LT = "0x72f20BDf450947d90132BDE7CebB763046b4A904";


    describe("Buy", async () => {
        it("buy USDT", async () => {
            const usdt = await ethers.getContractAt("MyToken", USDT_TOKEN);
            await usdt.approve(PERMIT2, ethers.constants.MaxUint256)
            const tokenSales = await ethers.getContractAt("HOPESalesAgent", TOKEN_SALE);
            const [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig1 = await PermitSigHelper.signature(owner, USDT_TOKEN, PERMIT2, TOKEN_SALE, BigNumber.from(1000), NONCE, 1704869166);
            console.log(sig1);
            await tokenSales.buy("USDT", 1_000, NONCE, 1704869166, sig1);
        })

        it.skip("Staking Hope", async () => {
            const [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
            const hope = await ethers.getContractAt("HOPE", HOPE_TOKEN);
            await hope.approve(PERMIT2, ethers.constants.MaxUint256);
            console.log(await hope.balanceOf(owner.address))
            const staking = await ethers.getContractAt("StakingHope", STAKING_HOPE);
            console.log(await staking.lpTotalSupply())
            let random = ethers.utils.randomBytes(32);
            let NONCE = BigNumber.from(random);
            const sig = await PermitSigHelper.signature(owner, HOPE_TOKEN, PERMIT2, STAKING_HOPE, ethers.utils.parseEther('1000'), NONCE, 1704869166);
            await staking.staking(ethers.utils.parseEther('1000'), NONCE, 1704869166, sig);

        })

        it.skip("UnStaking Hope", async () => {
            const [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
            const staking = await ethers.getContractAt("StakingHope", STAKING_HOPE);
            console.log("before: ", await staking.lpTotalSupply());
            await expect(staking.unStaking(BigNumber.from(100))).emit(staking, "UnStaking");
            console.log("after: ", await staking.lpTotalSupply());
        })
        
    })
    
}); 