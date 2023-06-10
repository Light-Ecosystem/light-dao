// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";

interface IBurner {
    function burn(address to, IERC20Upgradeable token, uint amount, uint amountOutMin) external;
}

interface IBurnerManager {
    function burners(address token) external returns (IBurner burner);
}

interface SwapPair {
    function mintFee() external;

    function burn(address to) external returns (uint amount0, uint amount1);

    function balanceOf(address account) external returns (uint256);

    function transfer(address to, uint value) external returns (bool);
}

contract FeeToVault is Ownable2StepUpgradeable, PausableUpgradeable, AccessControlUpgradeable {
    bytes32 public constant OPERATOR_ROLE = keccak256("Operator_Role");

    address public burnerManager;
    address public underlyingBurner;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _burnerManager, address _underlyingBurner) public initializer {
        require(_burnerManager != address(0), "Zero address not valid");
        require(_underlyingBurner != address(0), "Zero address not valid");

        __Ownable2Step_init();
        __Pausable_init();
        burnerManager = _burnerManager;
        underlyingBurner = _underlyingBurner;
    }

    function withdrawAdminFee(address pool) external whenNotPaused onlyRole(OPERATOR_ROLE) {
        _withdrawAdminFee(pool);
    }

    function withdrawMany(address[] memory pools) external whenNotPaused onlyRole(OPERATOR_ROLE) {
        for (uint256 i = 0; i < pools.length && i < 256; i++) {
            _withdrawAdminFee(pools[i]);
        }
    }

    function _withdrawAdminFee(address pool) internal {
        SwapPair pair = SwapPair(pool);
        pair.mintFee();
        uint256 tokenPBalance = SwapPair(pool).balanceOf(address(this));
        if (tokenPBalance > 0) {
            pair.transfer(address(pair), tokenPBalance);
            pair.burn(address(this));
        }
    }

    function _burn(IERC20Upgradeable token, uint amountIn, uint amountOutMin) internal {
        uint256 balanceOfThis = token.balanceOf(address(this));
        require(amountIn > 0 && amountIn <= balanceOfThis, "wrong amount in");

        // user choose to not burn token if not profitable
        IBurner burner = IBurnerManager(burnerManager).burners(address(token));
        require(burner != IBurner(address(0)), "Burner does not exist");
        TransferHelper.doApprove(address(token), address(burner), amountIn);
        burner.burn(underlyingBurner, token, amountIn, amountOutMin);
    }

    function burn(IERC20Upgradeable token, uint amountIn, uint amountOutMin) external whenNotPaused onlyRole(OPERATOR_ROLE) {
        _burn(token, amountIn, amountOutMin);
    }

    function burnMany(IERC20Upgradeable[] calldata tokens, uint[] calldata amountIns, uint[] calldata amountOutMins) external whenNotPaused onlyRole(OPERATOR_ROLE) {
        for (uint i = 0; i < tokens.length && i < 128; i++) {
            _burn(tokens[i], amountIns[i], amountOutMins[i]);
        }
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function isOperator(address _operator) external view returns (bool) {
        return hasRole(OPERATOR_ROLE, _operator);
    }

    function addOperator(address _operator) public onlyOwner {
        require(_operator != address(0), "Zero address not valid");
        _grantRole(OPERATOR_ROLE, _operator);
    }

    function removeOperator(address _operator) public onlyOwner {
        require(_operator != address(0), "Zero address not valid");
        _revokeRole(OPERATOR_ROLE, _operator);
    }
}
