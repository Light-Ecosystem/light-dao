// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

library UniversalERC20 {
    using SafeMath for uint256;
    using TransferHelper for address;

    IERC20 private constant ETH_MOCK_ADDRESS = IERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    function universalTransfer(IERC20 token, address to, uint256 amount) internal {
        if (amount > 0) {
            if (isETH(token)) {
                (bool success, ) = to.call{value: amount}(new bytes(0));
                require(success, "ETH_TRANSFER_FAILED");
            } else {
                address(token).doTransferOut(to, amount);
            }
        }
    }

    function universalApproveMax(IERC20 token, address to, uint256 amount) internal {
        uint256 allowance = token.allowance(address(this), to);
        if (allowance < amount) {
            if (allowance > 0) {
                address(token).doApprove(to, 0);
            }
            address(token).doApprove(to, type(uint256).max);
        }
    }

    function universalBalanceOf(IERC20 token, address who) internal view returns (uint256) {
        if (isETH(token)) {
            return who.balance;
        } else {
            return token.balanceOf(who);
        }
    }

    function tokenBalanceOf(IERC20 token, address who) internal view returns (uint256) {
        return token.balanceOf(who);
    }

    function isETH(IERC20 token) internal pure returns (bool) {
        return token == ETH_MOCK_ADDRESS;
    }
}
