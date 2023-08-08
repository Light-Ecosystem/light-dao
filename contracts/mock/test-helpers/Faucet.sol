// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import {IERC20Metadata, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {IMintableERC20} from "./interfaces/IMintableERC20.sol";

contract Faucet is Ownable2Step {
    struct AmountRestriction {
        uint256 amountAllowedDate; // Token and address daily limit
        uint256 totalAmountAllowedDate; // Total daily limit
    }

    mapping(address => AmountRestriction) public amountRestrictionMap;

    // Token and address Daily number
    mapping(uint256 => mapping(address => mapping(address => uint256))) public amountAllowedDate;
    // Total number of tokens per day
    mapping(uint256 => mapping(address => uint256)) public totalAmountAllowedDate;

    // If _permissioned is enabled, then only owner can mint Testnet ERC20 tokens
    // If disabled, anyone can call mint at the faucet, for PoC environments
    bool internal _permissioned;

    using ERC165Checker for address;

    /**
     * @dev Function modifier, if _permissioned is enabled then msg.sender is required to be the owner
     */
    modifier onlyOwnerIfPermissioned() {
        if (_permissioned == true) {
            require(owner() == _msgSender(), "Ownable: caller is not the owner");
        }
        _;
    }

    function mint(address token, uint256 amount) external onlyOwnerIfPermissioned returns (uint256) {
        _mint(token, _msgSender(), amount);
        return amount;
    }

    function mintTo(address token, address account, uint256 amount) external onlyOwnerIfPermissioned returns (uint256) {
        _mint(token, account, amount);
        return amount;
    }

    function getRemainingAllowedAmount(address _token, address _account) public view returns (uint256) {
        uint256 currentTime = _getCurrentTime();
        return amountRestrictionMap[_token].amountAllowedDate - amountAllowedDate[currentTime][_token][_account];
    }

    function transfer(address _token, address _to, uint256 _amount) public onlyOwner {
        bool success = IERC20(_token).transfer(_to, _amount);
        require(success, "TRANSFER FAILED");
    }

    function balanceOf(address _token, address _account) public view returns (uint256) {
        return IERC20(_token).balanceOf(_account);
    }

    function setAllownAmount(address _token, uint256 _amountAllowedDate, uint256 _totalAmountAllowedDate) public onlyOwner {
        if (keccak256(bytes(IERC20Metadata(_token).symbol())) == keccak256("HOPE")) {
            amountRestrictionMap[_token] = AmountRestriction(_amountAllowedDate, _totalAmountAllowedDate);
            return;
        }
        bool isSupportMintable = _token.supportsInterface(type(IMintableERC20).interfaceId);
        require(isSupportMintable, "ERC20 must be support mintable");
        amountRestrictionMap[_token] = AmountRestriction(_amountAllowedDate, _totalAmountAllowedDate);
    }

    function setPermissioned(bool permissioned) external onlyOwner {
        _permissioned = permissioned;
    }

    function isPermissioned() external view returns (bool) {
        return _permissioned;
    }

    function _mint(address _token, address _account, uint256 _amount) internal {
        uint256 currentTime = _getCurrentTime();
        require(tx.origin == _msgSender() && !_isContract(_account), "Contract addresses are not allowed");
        uint256 checkAmount = amountAllowedDate[currentTime][_token][_account] + _amount;
        require(checkAmount <= amountRestrictionMap[_token].amountAllowedDate, "The daily maximum is exceeded");

        checkAmount = totalAmountAllowedDate[currentTime][_token] + _amount;
        require(checkAmount <= amountRestrictionMap[_token].totalAmountAllowedDate, "Exceed the maximum daily currency limit");

        amountAllowedDate[currentTime][_token][_account] += _amount;
        totalAmountAllowedDate[currentTime][_token] += _amount;
        IMintableERC20(_token).mint(_account, _amount);
    }

    function _getCurrentTime() private view returns (uint256) {
        return (block.timestamp / 86400) * 86400;
    }

    function _isContract(address addr) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}
