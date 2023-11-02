// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract StETH is ERC20, Ownable2Step {
    event Referal(address indexed _sender, address _referal);

    bytes public constant EIP712_REVISION = bytes("1");
    bytes32 internal constant EIP712_DOMAIN =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    // Map of address nonces (address => nonce)
    mapping(address => uint256) internal _nonces;

    uint256 private _bufferETH;

    using SafeMath for uint256;

    bytes32 public DOMAIN_SEPARATOR;

    constructor() ERC20("Lido Staking ETH", "stETH") {
        uint256 chainId = block.chainid;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(EIP712_DOMAIN, keccak256(bytes(name())), keccak256(EIP712_REVISION), chainId, address(this))
        );
    }

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

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(owner != address(0), "INVALID_OWNER");
        //solium-disable-next-line
        require(block.timestamp <= deadline, "INVALID_EXPIRATION");
        uint256 currentValidNonce = _nonces[owner];
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, currentValidNonce, deadline))
            )
        );
        require(owner == ecrecover(digest, v, r, s), "INVALID_SIGNATURE");
        _nonces[owner] = currentValidNonce + 1;
        _approve(owner, spender, value);
    }

    function nonces(address owner) public view virtual returns (uint256) {
        return _nonces[owner];
    }

    function _getTotalShares() internal view virtual returns (uint256) {
        return super.totalSupply();
    }

    function _getTotalPooledEther() internal view virtual returns (uint256) {
        return _bufferETH;
    }
}
