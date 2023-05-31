// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

interface IConnect {
    function depositRewardToken(uint256 amount) external;

    function deposit(address token, address addr, uint256 amount) external returns (bool);
}

abstract contract AbsConnectVault is Ownable2StepUpgradeable, PausableUpgradeable, ERC20Upgradeable, AccessControlUpgradeable {
    event Deposit(address indexed token, address indexed from, uint256 amount);
    event Withdraw(address indexed token, address indexed to, uint256 amount);
    event ChangeConnect(address indexed newConnect);

    bytes32 public constant WITHDRAW_ADMIN_ROLE = keccak256("WITHDRAW_ADMIN_ROLE");

    // permit2 contract
    address public permit2Address;

    ///token address
    address public token;
    /// connect address
    address public connect;

    function _initialize(
        address _permit2Address,
        address _token,
        address _connect,
        address _withdrawAdmin,
        address _ownerAddress
    ) internal onlyInitializing {
        require(_ownerAddress != address(0), "CE000");
        // require(_connnet != address(0), "CE000");
        require(_token != address(0), "CE000");

        string memory _name = IERC20MetadataUpgradeable(_token).name();
        string memory _symbol = IERC20MetadataUpgradeable(_token).symbol();
        __ERC20_init(string.concat("b", _name), _symbol);

        connect = _connect;
        permit2Address = _permit2Address;
        token = _token;
        _transferOwnership(_ownerAddress);
        if (_withdrawAdmin != address(0)) {
            _grantRole(WITHDRAW_ADMIN_ROLE, _withdrawAdmin);
        }
    }

    function deposit(uint256 amount, uint256 nonce, uint256 deadline, bytes memory signature) external whenNotPaused returns (uint256) {
        require(connect != address(0), "connect is not initialized, please deposit later");
        require(amount != 0, "INVALID_ZERO_AMOUNT");
        address from = _msgSender();
        /// transferFrom token to this contract
        TransferHelper.doTransferIn(permit2Address, token, amount, from, nonce, deadline, signature);
        /// mint bToken to user
        _mint(from, amount);
        /// transfer bToken to connect
        _transfer(from, connect, amount);
        /// notify connect transfer info
        IConnect(connect).deposit(token, from, amount);

        emit Deposit(token, from, amount);

        return amount;
    }

    function withdraw(address to, uint256 amount) external whenNotPaused onlyRole(WITHDRAW_ADMIN_ROLE) returns (uint256) {
        require(amount > 0, "INVALID_ZERO_AMOUNT");
        require(amount <= balanceOf(msg.sender), "insufficient balance");
        /// burn bToken
        _burn(msg.sender, amount);
        /// transfer token to toAccount
        TransferHelper.doTransferOut(token, to, amount);
        emit Withdraw(token, to, amount);
        return amount;
    }

    function changeConnect(address newConnect) external onlyOwner {
        connect = newConnect;
        emit ChangeConnect(newConnect);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function grantRole(bytes32 role, address account) public override onlyOwner {
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public override onlyOwner {
        _revokeRole(role, account);
    }

    function rescueTokens(address _token, address _to, uint256 _amount) external onlyOwner {
        if (_token == token) {
            require(_amount <= (IERC20Upgradeable(_token).balanceOf(address(this)) - totalSupply()), "insufficient balance");
        }
        TransferHelper.doTransferOut(_token, _to, _amount);
    }

    // @dev This empty reserved space is put in place to allow future versions to add new
    // variables without shifting down storage in the inheritance chain.
    // See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[49] private __gap;
}
