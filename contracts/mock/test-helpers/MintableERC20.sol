// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20WithPermit} from "./interfaces/IERC20WithPermit.sol";
import {IMintableERC20} from "./interfaces/IMintableERC20.sol";

contract MintableERC20 is IMintableERC20, IERC20WithPermit, ERC20, Ownable2Step, AccessControl {
    bytes public constant EIP712_REVISION = bytes("1");
    bytes32 internal constant EIP712_DOMAIN =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Map of address nonces (address => nonce)
    mapping(address => uint256) internal _nonces;
    uint8 private _decimals;

    bytes32 public DOMAIN_SEPARATOR;

    constructor(string memory name, string memory symbol, uint8 decimals_, address faucet) ERC20(name, symbol) {
        uint256 chainId = block.chainid;

        DOMAIN_SEPARATOR = keccak256(abi.encode(EIP712_DOMAIN, keccak256(bytes(name)), keccak256(EIP712_REVISION), chainId, address(this)));
        _decimals = decimals_;
        _grantRole(MINTER_ROLE, _msgSender());
        _grantRole(MINTER_ROLE, faucet);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IMintableERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @inheritdoc IERC20WithPermit
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external override {
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

    /**
     * @dev Function to mint tokens
     * @param value The amount of tokens to mint.
     */
    function mint(uint256 value) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "Mintable: caller is not the minter");
        _mint(_msgSender(), value);
    }

    /**
     * @dev Function to mint tokens to address
     * @param account The account to mint tokens.
     * @param value The amount of tokens to mint.
     */
    function mint(address account, uint256 value) public virtual override {
        require(hasRole(MINTER_ROLE, _msgSender()), "Mintable: caller is not the minter");
        _mint(account, value);
    }

    function nonces(address owner) public view virtual returns (uint256) {
        return _nonces[owner];
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function approve(address spender, uint256 amount) public virtual override(ERC20, IERC20) returns (bool) {
        address owner = _msgSender();
        if (keccak256(bytes(symbol())) == keccak256("USDT")) {
            require(!((amount != 0) && (allowance(owner, spender) != 0)));
        }
        _approve(owner, spender, amount);
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
