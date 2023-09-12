// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract StETH is ERC20, Ownable2Step {
    event Referal(address indexed _sender, address _referal);

    uint256 private _bufferETH;

    using SafeMath for uint256;

    constructor() ERC20("Lido Staking ETH", "stETH") {}

    function submit(address _referal) external payable returns (uint256 sharesToMint) {
        sharesToMint = _mintShares(_msgSender(), msg.value);
        _bufferETH += msg.value;
        emit Referal(_msgSender(), _referal);
    }

    function withdraw(uint256 amount) external returns (uint256 sharesToBurn) {
        sharesToBurn = _burnShares(_msgSender(), amount);
        _bufferETH -= amount;
        payable(_msgSender()).transfer(amount);
    }

    function totalSupply() public view virtual override returns (uint256) {
        return address(this).balance;
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return getPooledEthByShares(super.balanceOf(account));
    }

    function _mintShares(address _user, uint256 _amount) internal returns (uint256) {
        uint256 _sharesToMint = getSharesByPooledEth(_amount);
        _mint(_user, _sharesToMint);
        return _sharesToMint;
    }

    function _burnShares(address _user, uint256 _amount) internal returns (uint256) {
        uint256 _sharesToMint = getSharesByPooledEth(_amount);
        _burn(_user, _sharesToMint);
        return _sharesToMint;
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        address from = _msgSender();
        uint256 _sharesToTransfer = getSharesByPooledEth(amount);
        _transfer(from, to, _sharesToTransfer);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        address spender = _msgSender();
        uint256 _sharesToTransfer = getSharesByPooledEth(amount);
        _spendAllowance(from, spender, _sharesToTransfer);
        _transfer(from, to, _sharesToTransfer);
        return true;
    }

    function getSharesByPooledEth(uint256 _ethAmount) public view returns (uint256) {
        if (_getTotalShares() == 0 || _getTotalPooledEther() == 0) {
            return _ethAmount.mul(1);
        }
        return _ethAmount.mul(_getTotalShares()).div(_getTotalPooledEther());
    }

    function getPooledEthByShares(uint256 _sharesAmount) public view returns (uint256) {
        if (_getTotalShares() == 0 || _getTotalPooledEther() == 0) {
            return _sharesAmount.mul(1);
        }
        return _sharesAmount.mul(_getTotalPooledEther()).div(_getTotalShares());
    }

    function receiveRewards() external payable onlyOwner {
        _bufferETH += msg.value;
    }

    function _getTotalShares() internal view virtual returns (uint256) {
        return super.totalSupply();
    }

    function _getTotalPooledEther() internal view virtual returns (uint256) {
        return _bufferETH;
    }
}
