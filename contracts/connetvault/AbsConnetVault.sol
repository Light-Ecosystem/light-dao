// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

interface IConnet {
    function depositRewardToken(uint256 amount) external;

    function deposit(address addr, uint256 amount) external returns (bool);
}

abstract contract AbsConnetVault is Ownable2StepUpgradeable, PausableUpgradeable, ERC20Upgradeable, AccessControlUpgradeable {
    event Deposit(address indexed from, uint256 amount);
    event RewardsDistributed(uint256 claimableTokens);
    event ChangeConnet(address indexed newConnet);

    bytes32 public constant withrawAdminRole = keccak256("withraw_Admin_Role");

    // permit2 contract
    address public permit2Address;

    ///token address
    address public token;
    /// connnet address
    address public connet;

    function _initialize(
        address _permit2Address,
        address _token,
        address _connnet,
        address _withdrawAdmin,
        address _ownerAddress
    ) internal onlyInitializing {
        require(_ownerAddress != address(0), "CE000");
        require(_connnet != address(0), "CE000");
        require(_token != address(0), "CE000");

        string memory _name = IERC20MetadataUpgradeable(_token).name();
        string memory _symbol = IERC20MetadataUpgradeable(_token).symbol();
        __ERC20_init(string.concat("b", _name), _symbol);

        connet = _connnet;
        permit2Address = _permit2Address;
        token = _token;
        _transferOwnership(_ownerAddress);
        if (_withdrawAdmin != address(0)) {
            _grantRole(withrawAdminRole, _withdrawAdmin);
        }
    }

    function deposit(uint256 amount, uint256 nonce, uint256 deadline, bytes memory signature) external whenNotPaused returns (uint256) {
        require(amount != 0, "INVALID_ZERO_AMOUNT");
        address from = _msgSender();
        /// transferFrom token to this contract
        TransferHelper.doTransferIn(permit2Address, token, amount, from, nonce, deadline, signature);
        /// mint bToken to user
        _mint(from, amount);
        /// tranfer bToken to connnet
        _transfer(from, connet, amount);
        /// notify connet transfer info
        IConnet(connet).deposit(from, amount);

        emit Deposit(from, amount);

        return amount;
    }

    function withdraw(address to, uint256 amount) external whenNotPaused onlyRole(withrawAdminRole) returns (uint256) {
        require(amount > 0, "INVALID_ZERO_AMOUNT");
        require(amount <= balanceOf(msg.sender), "insufficient balance");
        /// burn bToken
        _burn(msg.sender, amount);
        /// transfer token to toAccount
        TransferHelper.doTransferOut(token, to, amount);

        return amount;
    }

    function changeConnet(address newConnet) external onlyOwner {
        connet = newConnet;
        emit ChangeConnet(newConnet);
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

    // @dev This empty reserved space is put in place to allow future versions to add new
    // variables without shifting down storage in the inheritance chain.
    // See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[49] private __gap;
}
