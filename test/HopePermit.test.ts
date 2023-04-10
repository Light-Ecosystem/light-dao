import { ethers, upgrades, config } from "hardhat";
import { expect } from 'chai';
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { buildPermitParams, getSignatureFromTypedData } from "./SigHelper";

describe("HOPEPermit", () => {

    const accounts = config.networks.hardhat.accounts;
    const index = 0; // first wallet, increment for next wallets
    const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
    const ownerPrivateKey = wallet1.privateKey;

    const EIP712_REVISION = '1';
    const MAX_UINT_AMOUNT =
        '115792089237316195423570985008687907853269984665640564039457584007913129639935';

    async function deployHOPEFixture() {
        const [owner, spender, addr2, addr3, ...addrs] = await ethers.getSigners();
        const RestrictedList = await ethers.getContractFactory("RestrictedList");
        const restrictedList = await RestrictedList.deploy();
        console.log("RestrictedList deploy address: ", restrictedList.address);

        const HOPEToken = await ethers.getContractFactory("HOPE");
        const hopeToken = await upgrades.deployProxy(HOPEToken, [restrictedList.address]);
        await hopeToken.deployed();
        console.log("HOPEToken deploy address: ", hopeToken.address);

        const Admin = await ethers.getContractFactory("Admin");
        const admin = await Admin.deploy(hopeToken.address);
        console.log("Admin contract address: ", admin.address);

        const CREDIT = ethers.utils.parseEther("10");
        await hopeToken.grantAgent(
            admin.address,
            CREDIT,
            0,
            10000,
            true,
            true
        );
        await admin.mint(owner.address, CREDIT);

        return { owner, spender, addr2, addr3, hopeToken, restrictedList, admin }
    }

    describe("permit", async () => {
        it('Tries to submit a permit with 0 expiration (revert expected)', async () => {
            const { hopeToken, owner, spender } = await loadFixture(deployHOPEFixture);

            const tokenName = await hopeToken.name();

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const expiration = 0;
            const nonce = (await hopeToken.nonces(owner.address)).toNumber();
            const permitAmount = ethers.utils.parseEther('2').toString();
            const msgParams = buildPermitParams(
                chainId,
                hopeToken.address,
                EIP712_REVISION,
                tokenName,
                owner.address,
                spender.address,
                nonce,
                permitAmount,
                expiration.toFixed()
            );

            const ownerPrivateKey = wallet1.privateKey;

            expect((await hopeToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                '0',
                'INVALID_ALLOWANCE_BEFORE_PERMIT'
            );

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                hopeToken.permit(owner.address, spender.address, permitAmount, expiration, v, r, s)
            ).to.be.revertedWith("PERMIT_DEADLINE_EXPIRED");

            expect((await hopeToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                '0',
                'INVALID_ALLOWANCE_AFTER_PERMIT'
            );
        });

        it('Submits a permit with maximum expiration length', async () => {
            const { hopeToken, owner, spender } = await loadFixture(deployHOPEFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const deadline = MAX_UINT_AMOUNT;
            const nonce = (await hopeToken.nonces(owner.address)).toNumber();
            const permitAmount = ethers.utils.parseEther('2').toString();
            const msgParams = buildPermitParams(
                chainId,
                hopeToken.address,
                EIP712_REVISION,
                await hopeToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const ownerPrivateKey = wallet1.privateKey;

            expect((await hopeToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                '0',
                'INVALID_ALLOWANCE_BEFORE_PERMIT'
            );

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            expect(
                await hopeToken.permit(owner.address, spender.address, permitAmount, deadline, v, r, s)
            );

            expect((await hopeToken.nonces(owner.address)).toNumber()).to.be.equal(1);
        });

        it('Cancels the previous permit', async () => {
            const { hopeToken, owner, spender } = await loadFixture(deployHOPEFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const deadline = MAX_UINT_AMOUNT;
            let nonce = (await hopeToken.nonces(owner.address)).toNumber();
            let permitAmount = ethers.utils.parseEther('2').toString();

            const msgParams1 = buildPermitParams(
                chainId,
                hopeToken.address,
                EIP712_REVISION,
                await hopeToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const ownerPrivateKey = wallet1.privateKey;

            const sig = getSignatureFromTypedData(ownerPrivateKey, msgParams1);
            await hopeToken.permit(owner.address, spender.address, permitAmount, deadline, sig.v, sig.r, sig.s)

            permitAmount = "0"
            nonce++;
            const msgParams = buildPermitParams(
                chainId,
                hopeToken.address,
                EIP712_REVISION,
                await hopeToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            expect((await hopeToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                ethers.utils.parseEther('2'),
                'INVALID_ALLOWANCE_BEFORE_PERMIT'
            );

            expect(
                await hopeToken.permit(owner.address, spender.address, permitAmount, deadline, v, r, s)
            );
            expect((await hopeToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                permitAmount,
                'INVALID_ALLOWANCE_AFTER_PERMIT'
            );

            expect((await hopeToken.nonces(owner.address)).toNumber()).to.be.equal(2);
        });

        it('Tries to submit a permit with invalid nonce (revert expected)', async () => {
            const { hopeToken, owner, spender } = await loadFixture(deployHOPEFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const deadline = MAX_UINT_AMOUNT;
            const nonce = 1000;
            const permitAmount = '0';
            const msgParams = buildPermitParams(
                chainId,
                hopeToken.address,
                EIP712_REVISION,
                await hopeToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const ownerPrivateKey = wallet1.privateKey;

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                hopeToken.permit(owner.address, spender.address, permitAmount, deadline, v, r, s)
            ).to.be.revertedWith("INVALID_SIGNER");
        });

        it('Tries to submit a permit with invalid expiration (previous to the current block) (revert expected)', async () => {
            const { hopeToken, owner, spender } = await loadFixture(deployHOPEFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const expiration = '1';
            const nonce = (await hopeToken.nonces(owner.address)).toNumber();
            const permitAmount = '0';
            const msgParams = buildPermitParams(
                chainId,
                hopeToken.address,
                EIP712_REVISION,
                await hopeToken.name(),
                owner.address,
                spender.address,
                nonce,
                expiration,
                permitAmount
            );

            const ownerPrivateKey = wallet1.privateKey;

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                hopeToken.permit(owner.address, spender.address, expiration, permitAmount, v, r, s)
            ).to.be.revertedWith("PERMIT_DEADLINE_EXPIRED");
        });

        it('Tries to submit a permit with invalid signature (revert expected)', async () => {
            const { hopeToken, owner, spender } = await loadFixture(deployHOPEFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const deadline = MAX_UINT_AMOUNT;
            const nonce = (await hopeToken.nonces(owner.address)).toNumber();
            const permitAmount = '0';
            const msgParams = buildPermitParams(
                chainId,
                hopeToken.address,
                EIP712_REVISION,
                await hopeToken.name(),
                owner.address,
                spender.address,
                nonce,
                deadline,
                permitAmount
            );

            const ownerPrivateKey = wallet1.privateKey;

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                hopeToken.permit(owner.address, ethers.constants.AddressZero, permitAmount, deadline, v, r, s)
            ).to.be.revertedWith("INVALID_SIGNER");
        });

        it('Tries to submit a permit with invalid owner (revert expected)', async () => {
            const { hopeToken, owner, spender } = await loadFixture(deployHOPEFixture);

            const chainId = (await ethers.provider.getNetwork()).chainId;
            const expiration = MAX_UINT_AMOUNT;
            const nonce = (await hopeToken.nonces(owner.address)).toNumber();
            const permitAmount = '0';
            const msgParams = buildPermitParams(
                chainId,
                hopeToken.address,
                EIP712_REVISION,
                await hopeToken.name(),
                owner.address,
                spender.address,
                nonce,
                expiration,
                permitAmount
            );

            const ownerPrivateKey = wallet1.privateKey;

            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

            await expect(
                hopeToken.permit(ethers.constants.AddressZero, spender.address, expiration, permitAmount, v, r, s)
            ).to.be.revertedWith("INVALID_OWNER");
        });
        it("permit & transfer", async () => {
            const { owner, spender, addr2, hopeToken } = await loadFixture(deployHOPEFixture)
            const chainId = (await ethers.provider.getNetwork()).chainId;
            const nonce = await hopeToken.nonces(owner.address);
            const permitAmount = ethers.utils.parseEther('10').toString();
            const DEADLINE = await time.latest() + 10 * 60;

            const msgParams = buildPermitParams(
                chainId,
                hopeToken.address,
                EIP712_REVISION,
                await hopeToken.name(),
                owner.address,
                spender.address,
                nonce.toNumber(),
                DEADLINE.toString(),
                permitAmount
            );

            const ownerPrivateKey = wallet1.privateKey;
            const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);
            await hopeToken.permit(owner.address, spender.address, permitAmount, DEADLINE, v, r, s)
            expect((await hopeToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                permitAmount,
                'INVALID_ALLOWANCE_AFTER_PERMIT'
            );
            expect((await hopeToken.nonces(owner.address)).toNumber()).to.be.equal(1);

            await hopeToken.connect(spender).transferFrom(owner.address, addr2.address, ethers.utils.parseEther("1"));
            expect((await hopeToken.allowance(owner.address, spender.address)).toString()).to.be.equal(
                ethers.utils.parseEther("9"),
                'INVALID_ALLOWANCE_AFTER_TRANSFER'
            );
            expect(await hopeToken.balanceOf(owner.address)).to.be.equal(ethers.utils.parseEther("9"))
            expect(await hopeToken.balanceOf(addr2.address)).to.be.equal(ethers.utils.parseEther("1"))
        })
    })

})