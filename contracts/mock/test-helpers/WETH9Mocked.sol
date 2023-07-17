// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IMintableERC20} from "./interfaces/IMintableERC20.sol";

contract WETH9Mocked is IMintableERC20, Ownable2Step, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;

    event Approval(address indexed src, address indexed guy, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);
    event Deposit(address indexed dst, uint wad);
    event Withdrawal(address indexed src, uint wad);
    event Mint(address indexed src, uint amount);

    uint256 public totalSupply;
    mapping(address => uint) public balanceOf;
    mapping(address => uint) public actualBalanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    constructor(address faucet) {
        _grantRole(MINTER_ROLE, _msgSender());
        _grantRole(MINTER_ROLE, faucet);
    }

    fallback() external payable {
        deposit();
    }

    receive() external payable {
        deposit();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IMintableERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        actualBalanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint wad) public {
        require(actualBalanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] -= wad;
        actualBalanceOf[msg.sender] -= wad;
        totalSupply -= wad;
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }

    function mint(uint256 value) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "Mintable: caller is not the minter");
        balanceOf[msg.sender] += value;
        totalSupply += value;
        emit Mint(msg.sender, value);
    }

    function mint(address account, uint256 value) public virtual override {
        require(hasRole(MINTER_ROLE, _msgSender()), "Mintable: caller is not the minter");
        balanceOf[account] += value;
        totalSupply += value;
        emit Mint(account, value);
    }

    function actualTotalSupply() public view returns (uint) {
        return address(this).balance;
    }

    function approve(address guy, uint wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint wad) public returns (bool) {
        require(balanceOf[src] >= wad);

        if (src != msg.sender && allowance[src][msg.sender] != type(uint).max) {
            require(allowance[src][msg.sender] >= wad);
            allowance[src][msg.sender] -= wad;
        }

        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        if (wad <= actualBalanceOf[src]) {
            actualBalanceOf[src] -= wad;
            actualBalanceOf[dst] += wad;
        } else {
            actualBalanceOf[dst] += actualBalanceOf[src];
            actualBalanceOf[src] = 0;
        }

        emit Transfer(src, dst, wad);

        return true;
    }

    function isMinter(address _minter) external view returns (bool) {
        return hasRole(MINTER_ROLE, _minter);
    }

    function addMinter(address _minter) external onlyOwner {
        _grantRole(MINTER_ROLE, _minter);
    }

    function removeMinter(address _minter) external onlyOwner {
        _revokeRole(MINTER_ROLE, _minter);
    }
}
