// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IValut {
    function withdraw(address to, uint256 amount) external returns (uint256);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MockConnet is Ownable2Step {
    address public valut;
    address public ltToken;

    function setValut(address _valut) external onlyOwner returns (bool) {
        valut = _valut;
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

    function withdraw(address to, uint256 amount) external onlyOwner {
        IValut(valut).withdraw(to, amount);
    }

    function transferBToken(address to, uint256 amount) external onlyOwner {
        IERC20(valut).transfer(to, amount);
    }
}
