import { ethers, upgrades } from "hardhat";
import { expect } from 'chai';
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { buildPermitParams, getSignatureFromTypedData } from "./contracts-helpers";
import { getTestWallets } from './utils/wallets';

describe("LTPermit", () => {

    let testWallets = getTestWallets();
    const EIP712_REVISION = '1';
    const MAX_UINT_AMOUNT =
        '115792089237316195423570985008687907853269984665640564039457584007913129639935';

    async function deployLTFixture() {
        const [owner, spender, addr2, addr3, ...addrs] = await ethers.getSigners();

        let MyLT = await ethers.getContractFactory("LT");
        const ltToken = await upgrades.deployProxy(MyLT, ['LT Dao Token', 'LT']);
        await ltToken.deployed();

        return { owner, spender, addr2, addr3, ltToken, }
    }

    describe("permit", async () => {
        it('Tries to submit a permit with 0 expiration (revert expected)', async () => {
            const { ltToken, owner, spender } = await loadFixture(deployLTFixture);

            const tokenName = await ltToken.name();

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const expiration = 0;
            const nonce = (await ltToken.nonces(owner.address)).toNumber();
            const permitAmount = ethers.utils.parseEther('2').toString();
            const msgParams = buildPermitParams(
                chainId,
                ltToken.address,
                EIP712_REVISION,
                tokenName,
                owner.address,
                spender.address,
                nonce,
                permitAmount,
                expiration.toFixed()
            );

            const ownerPrivateKey = testWallets[0].secretKey;

            expect((await ltToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                '0',
                'INVALID_ALLOWANCE_BEFORE_PERMIT'
            );

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                ltToken.permit(owner.address, spender.address, permitAmount, expiration, v, r, s)
            ).to.be.revertedWith("PERMIT_DEADLINE_EXPIRED");

            expect((await ltToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                '0',
                'INVALID_ALLOWANCE_AFTER_PERMIT'
            );
        });

        it('Submits a permit with maximum expiration length', async () => {
            const { ltToken, owner, spender } = await loadFixture(deployLTFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const deadline = MAX_UINT_AMOUNT;
            const nonce = (await ltToken.nonces(owner.address)).toNumber();
            const permitAmount = ethers.utils.parseEther('2').toString();
            const msgParams = buildPermitParams(
                chainId,
                ltToken.address,
                EIP712_REVISION,
                await ltToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const ownerPrivateKey = testWallets[0].secretKey;

            expect((await ltToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                '0',
                'INVALID_ALLOWANCE_BEFORE_PERMIT'
            );

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            expect(
                await ltToken.permit(owner.address, spender.address, permitAmount, deadline, v, r, s)
            );

            expect((await ltToken.nonces(owner.address)).toNumber()).to.be.equal(1);
        });

        it('Cancels the previous permit', async () => {
            const { ltToken, owner, spender } = await loadFixture(deployLTFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const deadline = MAX_UINT_AMOUNT;
            let nonce = (await ltToken.nonces(owner.address)).toNumber();
            let permitAmount = ethers.utils.parseEther('2').toString();

            const msgParams1 = buildPermitParams(
                chainId,
                ltToken.address,
                EIP712_REVISION,
                await ltToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const ownerPrivateKey = testWallets[0].secretKey;

            const sig = getSignatureFromTypedData(ownerPrivateKey, msgParams1);
            await ltToken.permit(owner.address, spender.address, permitAmount, deadline, sig.v, sig.r, sig.s)

            permitAmount = "0"
            nonce++;
            const msgParams = buildPermitParams(
                chainId,
                ltToken.address,
                EIP712_REVISION,
                await ltToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            expect((await ltToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                ethers.utils.parseEther('2'),
                'INVALID_ALLOWANCE_BEFORE_PERMIT'
            );

            expect(
                await ltToken.permit(owner.address, spender.address, permitAmount, deadline, v, r, s)
            );
            expect((await ltToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                permitAmount,
                'INVALID_ALLOWANCE_AFTER_PERMIT'
            );

            expect((await ltToken.nonces(owner.address)).toNumber()).to.be.equal(2);
        });

        it('Tries to submit a permit with invalid nonce (revert expected)', async () => {
            const { ltToken, owner, spender } = await loadFixture(deployLTFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const deadline = MAX_UINT_AMOUNT;
            const nonce = 1000;
            const permitAmount = '0';
            const msgParams = buildPermitParams(
                chainId,
                ltToken.address,
                EIP712_REVISION,
                await ltToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const ownerPrivateKey = testWallets[0].secretKey;

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                ltToken.permit(owner.address, spender.address, permitAmount, deadline, v, r, s)
            ).to.be.revertedWith("INVALID_SIGNER");
        });

        it('Tries to submit a permit with invalid expiration (previous to the current block) (revert expected)', async () => {
            const { ltToken, owner, spender } = await loadFixture(deployLTFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const expiration = '1';
            const nonce = (await ltToken.nonces(owner.address)).toNumber();
            const permitAmount = '0';
            const msgParams = buildPermitParams(
                chainId,
                ltToken.address,
                EIP712_REVISION,
                await ltToken.name(),
                owner.address,
                spender.address,
                nonce,
                expiration,
                permitAmount
            );

            const ownerPrivateKey = testWallets[0].secretKey;

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                ltToken.permit(owner.address, spender.address, expiration, permitAmount, v, r, s)
            ).to.be.revertedWith("PERMIT_DEADLINE_EXPIRED");
        });

        it('Tries to submit a permit with invalid signature (revert expected)', async () => {
            const { ltToken, owner, spender } = await loadFixture(deployLTFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const deadline = MAX_UINT_AMOUNT;
            const nonce = (await ltToken.nonces(owner.address)).toNumber();
            const permitAmount = '0';
            const msgParams = buildPermitParams(
                chainId,
                ltToken.address,
                EIP712_REVISION,
                await ltToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const ownerPrivateKey = testWallets[0].secretKey;

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                ltToken.permit(owner.address, ethers.constants.AddressZero, permitAmount, deadline, v, r, s)
            ).to.be.revertedWith("INVALID_SIGNER");
        });

        it('Tries to submit a permit with invalid owner (revert expected)', async () => {
            const { ltToken, owner, spender } = await loadFixture(deployLTFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const expiration = MAX_UINT_AMOUNT;
            const nonce = (await ltToken.nonces(owner.address)).toNumber();
            const permitAmount = '0';
            const msgParams = buildPermitParams(
                chainId,
                ltToken.address,
                EIP712_REVISION,
                await ltToken.name(),
                owner.address,
                spender.address,
                nonce,
                expiration,
                permitAmount
            );

            const ownerPrivateKey = testWallets[0].secretKey;

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                ltToken.permit(ethers.constants.AddressZero, spender.address, expiration, permitAmount, v, r, s)
            ).to.be.revertedWith("INVALID_OWNER");
        });
        it("permit & transfer", async () => {
            const { owner, spender, addr2, ltToken } = await loadFixture(deployLTFixture)
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const nonce = await ltToken.nonces(owner.address);
            const permitAmount = ethers.utils.parseEther('10').toString();
            const DEADLINE = await time.latest() + 10 * 60;

            const msgParams = buildPermitParams(
                chainId,
                ltToken.address,
                EIP712_REVISION,
                await ltToken.name(),
                owner.address,
                spender.address,
                nonce.toNumber(),
                DEADLINE.toString(),
                permitAmount
            );
            const { v, r, s } = getSignatureFromTypedData(testWallets[0].secretKey, msgParams);
            await ltToken.permit(owner.address, spender.address, permitAmount, DEADLINE, v, r, s)
            expect((await ltToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                permitAmount,
                'INVALID_ALLOWANCE_AFTER_PERMIT'
            );
            expect((await ltToken.nonces(owner.address)).toNumber()).to.be.equal(1);

            await ltToken.connect(spender).transferFrom(owner.address, addr2.address, ethers.utils.parseEther("1"));
            expect((await ltToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                ethers.utils.parseEther("9"),
                'INVALID_ALLOWANCE_AFTER_TRANSFER'
            );
            expect(await ltToken.balanceOf(owner.address)).to.be.equal(ethers.utils.parseEther("399999999999"))
            expect(await ltToken.balanceOf(addr2.address)).to.be.equal(ethers.utils.parseEther("1"))
        })
    })

})