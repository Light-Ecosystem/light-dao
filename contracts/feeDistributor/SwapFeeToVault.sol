// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../feeDistributor/BurnerManager.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";

interface SwapPair {
    function mintFee() external;

    function burn(address to) external returns (uint amount0, uint amount1);

    function balanceOf(address account) external returns (uint256);

    function transfer(address to, uint value) external returns (bool);
}

contract SwapFeeToVault is Ownable2Step, Pausable {
    BurnerManager public burnerManager;
    address public underlyingBurner;

    constructor(BurnerManager _burnerManager, address _underlyingBurner) {
        require(address(_burnerManager) != address(0), "Invalid Address");
        require(_underlyingBurner != address(0), "Invalid Address");

        burnerManager = _burnerManager;
        underlyingBurner = _underlyingBurner;
    }

    function withdrawAdminFee(address pool) external whenNotPaused {
        SwapPair pair = SwapPair(pool);
        pair.mintFee();
        uint256 tokenPBalance = SwapPair(pool).balanceOf(address(this));
        if (tokenPBalance > 0) {
            pair.transfer(address(pair), tokenPBalance);
            pair.burn(address(this));
        }
    }

    function withdrawMany(address[] memory pools) external whenNotPaused {
        for (uint256 i = 0; i < pools.length && i < 256; i++) {
            this.withdrawAdminFee(pools[i]);
        }
    }

    function _burn(IERC20 token, uint amountOutMin) internal {
        uint256 amount = token.balanceOf(address(this));
        // user choose to not burn token if not profitable
        if (amount > 0) {
            IBurner burner = burnerManager.burners(address(token));
            TransferHelper.doApprove(address(token), address(burner), amount);
            require(burner != IBurner(address(0)), "SFTV01");
            burner.burn(underlyingBurner, token, amount, amountOutMin);
        }
    }

    function burn(IERC20 token, uint amountOutMin) external whenNotPaused {
        require(msg.sender == tx.origin, "SFTV02");
        _burn(token, amountOutMin);
    }

    function burnMany(IERC20[] calldata tokens, uint[] calldata amountOutMin) external whenNotPaused {
        require(msg.sender == tx.origin, "SFTV02");
        for (uint i = 0; i < tokens.length && i < 128; i++) {
            _burn(tokens[i], amountOutMin[i]);
        }
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
