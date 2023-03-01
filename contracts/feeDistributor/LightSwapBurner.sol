// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IBurner.sol";

interface ISwapRouter {
    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract LightSwapBurner is IBurner, Ownable2Step {
    event SetRouters(ISwapRouter[] _routers);

    ISwapRouter[] public routers;
    IERC20 public immutable HOPE;
    mapping(ISwapRouter => mapping(IERC20 => bool)) public approved;

    constructor(IERC20 _HOPE) {
        HOPE = _HOPE;
    }

    /**
     * @notice Set routers
     * @param _routers routers implment ISwapRouter
     */
    function setRouters(ISwapRouter[] calldata _routers) external onlyOwner {
        require(_routers.length != 0, "invalid param");
        for (uint i = 0; i < routers.length; i++) {
            require(address(routers[i]) != address(0), "invalid address");
        }
        routers = _routers;
        emit SetRouters(_routers);
    }

    function burn(address to, IERC20 token, uint amount) external {
        if (token == HOPE) {
            require(token.transferFrom(msg.sender, to, amount), "LSB00");
            return;
        }

        uint256 balanceBefore = token.balanceOf(address(this));
        require(token.transferFrom(msg.sender, address(this), amount), "LSB01");
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 spendAmount = balanceAfter - balanceBefore;

        ISwapRouter bestRouter = routers[0];
        uint bestExpected = 0;
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(HOPE);

        for (uint i = 0; i < routers.length; i++) {
            uint[] memory expected = routers[i].getAmountsOut(spendAmount, path);
            if (expected[0] > bestExpected) {
                bestExpected = expected[0];
                bestRouter = routers[i];
            }
        }

        if (!approved[bestRouter][token]) {
            bool success = IERC20(token).approve(address(bestRouter), type(uint).max);
            require(success, "LSB01");
            approved[bestRouter][token] = true;
        }

        bestRouter.swapExactTokensForTokens(spendAmount, 0, path, to, block.timestamp);
    }
}
