import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


export class PermitSigHelper {

    /**
     * cal permit sig
     * @param owner transfer-from
     * @param token erc20Token
     * @param permit2Contract permit2Address
     * @param spender spender address, genurally,it is smart contract
     * @param amountTo transfer amount value
     * @param nonce  random nonce
     * @param deadline  sig expire timestamp
     * @returns 
     */
    public static async signature(owner: SignerWithAddress, token: string, permit2Contract: string, spender: string, amountTo: BigNumber, nonce: BigNumber, deadline: number): Promise<string> {
        const chainId = await owner.getChainId();
        const domain = {
            name: 'Permit2',
            chainId: chainId,
            verifyingContract: permit2Contract,
        };

        const types = {
            PermitTransferFrom: [
                { name: 'permitted', type: 'TokenPermissions' },
                { name: 'spender', type: 'address' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' }
            ],
            TokenPermissions: [
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
            ],
        };

        const message = {
            permitted: {
                token: token,
                amount: amountTo
            },
            spender: spender,
            nonce: nonce,
            deadline: deadline
        };

        const signature = await owner._signTypedData(
            domain,
            types,
            message
        )

        return signature;
    }

}