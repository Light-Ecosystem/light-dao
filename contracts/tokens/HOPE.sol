// SPDX-License-Identifier: LGPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "../agents/AgentManager.sol";
import "../interfaces/IRestrictedList.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/**
 * @title LT Dao's HOPE Token Contract
 * @notice $HOPE, the ecosystem’s native pricing token backed by reserves
 * @author LT
 */
contract HOPE is ERC20Upgradeable, AgentManager {
    // RestrictedList contract
    address public restrictedList;

    function initialize(address _restrictedList) external initializer {
        require(_restrictedList != address(0), "CE000");
        restrictedList = _restrictedList;
        __Ownable2Step_init();
        __ERC20_init("HOPE", "HOPE");
    }

    /**
     * @notice mint amount to address
     * @dev mint only support Agent & Minable
     * @param to min to address
     * @param amount mint amount
     */
    function mint(address to, uint256 amount) public onlyAgent onlyMinable {
        require(!IRestrictedList(restrictedList).getRestrictedListStatus(to), "FA000");
        require(tx.origin != _msgSender(), "HO000");
        require(getEffectiveTime(_msgSender()) <= block.timestamp, "AG014");
        require(getExpirationTime(_msgSender()) >= block.timestamp, "AG011");
        require(getRemainingCredit(_msgSender()) >= amount, "AG004");
        _mint(to, amount);
        _decreaseRemainingCredit(_msgSender(), amount);
    }

    /**
     * @notice burn amount from sender
     * @dev mint only support Agent & Burnable
     * @param amount burn amount
     */
    function burn(uint256 amount) external onlyAgent onlyBurnable {
        require(getEffectiveTime(_msgSender()) <= block.timestamp, "AG014");
        require(getExpirationTime(_msgSender()) >= block.timestamp, "AG011");
        _burn(_msgSender(), amount);
        _increaseRemainingCredit(_msgSender(), amount);
    }

    /**
     * @notice restricted list cannot call
     * @dev transfer token for a specified address
     * @param to The address to transfer to.
     * @param amount The amount to be transferred.
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        require(
            !IRestrictedList(restrictedList).getRestrictedListStatus(msg.sender) &&
                !IRestrictedList(restrictedList).getRestrictedListStatus(to),
            "FA000"
        );
        return super.transfer(to, amount);
    }

    /**
     * @notice restricted list cannot call
     * @dev Transfer tokens from one address to another
     * @param from address The address which you want to send tokens from
     * @param to address The address which you want to transfer to
     * @param amount uint the amount of tokens to be transferred
     */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(
            !IRestrictedList(restrictedList).getRestrictedListStatus(from) && !IRestrictedList(restrictedList).getRestrictedListStatus(to),
            "FA000"
        );
        return super.transferFrom(from, to, amount);
    }
}
