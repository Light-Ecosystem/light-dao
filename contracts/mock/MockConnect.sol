// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IVault {
    function withdraw(address to, uint256 amount) external returns (uint256);

    function transferLTRewards(address to, uint256 amount) external returns (bool);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MockConnect is Ownable2Step {
    address public vault;
    address public ltToken;

    function setVault(address _vault) external onlyOwner returns (bool) {
        vault = _vault;
    }

    function setLt(address _addr) external onlyOwner returns (bool) {
        ltToken = _addr;
    }

    function depositRewardToken(uint256 amount) external {
        IERC20(ltToken).transferFrom(msg.sender, address(this), amount);
    }

    function deposit(address token, address addr, uint256 amount) external returns (bool) {
        return true;
    }

    function transferLTRewards(address to, uint256 amount) external onlyOwner returns (bool) {
        IVault(vault).transferLTRewards(to, amount);
        return true;
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        IVault(vault).withdraw(to, amount);
    }

    function transferBToken(address to, uint256 amount) external onlyOwner {
        IERC20(vault).transfer(to, amount);
    }
}
