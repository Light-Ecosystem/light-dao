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
        routers = _routers;
    }

    function burn(address to, IERC20 token, uint amount) external {
        if (token == HOPE) {
            require(token.transferFrom(msg.sender, to, amount), "LSB00");
            return;
        }

        require(token.transferFrom(msg.sender, address(this), amount), "LSB01");

        ISwapRouter bestRouter = routers[0];
        uint bestExpected = 0;
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(HOPE);

        for (uint i = 0; i < routers.length; i++) {
            uint[] memory expected = routers[i].getAmountsOut(amount, path);
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

        bestRouter.swapExactTokensForTokens(amount, 0, path, to, block.timestamp);
    }
}
