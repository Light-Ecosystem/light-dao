// SPDX-License-Identifier: LGPL-3.0

pragma solidity 0.8.17;

import "./interfaces/ILT.sol";
import "./interfaces/IGombocController.sol";

interface LiquidityGomboc {
    function integrateFraction(address addr) external view returns (uint256);

    function userCheckpoint(address addr) external returns (bool);
}

contract Minter {
    event Minted(address indexed recipient, address gomboc, uint256 minted);

    address public token;
    address public controller;

    // user -> gomboc -> value
    mapping(address => mapping(address => uint256)) public minted;

    // minter -> user -> can mint?
    mapping(address => mapping(address => bool)) public allowedToMintFor;

    /*
     * @notice Contract constructor
     * @param _token  LT Token Address
     * @param _controller gomboc Controller Address
     */
    constructor(address _token, address _controller) {
        token = _token;
        controller = _controller;
    }

    /**
     * @notice Mint everything which belongs to `msg.sender` and send to them
     * @param gombocAddress `LiquidityGomboc` address to get mintable amount from
     */
    function mint(address gombocAddress) external {
        _mintFor(gombocAddress, msg.sender);
    }

    /**
     * @notice Mint everything which belongs to `msg.sender` across multiple gombocs
     * @param gombocAddressList List of `LiquidityGomboc` addresses
     */
    function mintMany(address[] memory gombocAddressList) external {
        for (uint256 i = 0; i < gombocAddressList.length; i++) {
            if (gombocAddressList[i] == address(0)) {
                continue;
            }
            _mintFor(gombocAddressList[i], msg.sender);
        }
    }

    /**
     * @notice Mint tokens for `_for`
     * @dev Only possible when `msg.sender` has been approved via `toggle_approve_mint`
     * @param gombocAddress `LiquidityGomboc` address to get mintable amount from
     * @param _for Address to mint to
     */
    function mintFor(address gombocAddress, address _for) external {
        if (allowedToMintFor[msg.sender][_for]) {
            _mintFor(gombocAddress, _for);
        }
    }

    /**
     * @notice allow `mintingUser` to mint for `msg.sender`
     * @param mintingUser Address to toggle permission for
     */
    function toggleApproveMint(address mintingUser) external {
        bool flag = allowedToMintFor[mintingUser][msg.sender];
        allowedToMintFor[mintingUser][msg.sender] = !flag;
    }

    function _mintFor(address gombocAddr, address _for) internal {
        ///Gomnoc not adde
        require(IGombocController(controller).gombocTypes(gombocAddr) >= 0, "CE000");

        LiquidityGomboc(gombocAddr).userCheckpoint(_for);
        uint256 totalMint = LiquidityGomboc(gombocAddr).integrateFraction(_for);
        uint256 toMint = totalMint - minted[_for][gombocAddr];

        if (toMint != 0) {
            minted[_for][gombocAddr] = totalMint;
            ILT(token).mint(_for, toMint);
            emit Minted(_for, gombocAddr, toMint);
        }
    }
}
