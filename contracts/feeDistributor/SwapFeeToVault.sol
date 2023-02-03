// SPDX-License-Identifier: LGPL-3.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface SwapPair {
    function burn(address to) external returns (uint amount0, uint amount1);

    function balanceOf(address account) external returns (uint256);

    function transferFrom(address from, address to, uint value) external returns (bool);
}

contract SwapFeeToVault is Ownable2Step, Pausable {
    address public burnerManger;

    constructor(address _burnerManger) {
        burnerManger = _burnerManger;
    }

    function withdrawAdminFee(address pool) external whenNotPaused {
        uint256 tokenPBalance = SwapPair(pool).balanceOf(address(this));
        require(tokenPBalance > 0, "balance zero");

        SwapPair pair = SwapPair(pool);
        pair.transferFrom(this, pair, tokenPBalance);
        pair.burn(this);
    }

    function withdrawMany(address[] memory pools) external whenNotPaused {
        for (uint256 i = 0; i < pools.length; i++) {
            this.withdrawAdminFee(pools[i]);
        }
    }

    function burn(address token) external {}

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
