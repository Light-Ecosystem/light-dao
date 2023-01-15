// SPDX-License-Identifier: LGPL-3.0

pragma solidity >=0.8.0 <0.9.0;

interface IRestrictedList {
    /**
     * @dev Return whether the address exists in the restricted list
     */
    function getRestrictedListStatus(address _maker) external view returns (bool);

    /**
     * @dev Add the address to the restricted list
     */
    function addRestrictedList(address _evilUser) external;

    /**
     * @dev Remove the address to the restricted list
     */
    function removeRestrictedList(address _clearedUser) external;
}
