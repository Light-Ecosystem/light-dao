// SPDX-License-Identifier: LGPL-3.0

pragma solidity >=0.8.0 <0.9.0;

interface IAgentManager {
    /**
     * @dev Emitted when grant agent data
     */
    event AgentGranted(
        address indexed account,
        uint256 credit,
        uint256 effectiveTime,
        uint256 expirationTime,
        bool minable,
        bool burnable,
        address sender
    );
    /**
     * @dev Emitted when revoked agent role
     */
    event AgentRevoked(address indexed account, address sender);

    /**
     * @dev Emitted when increase agent credit
     */
    event AgentIncreaseCredit(address indexed account, uint256 credit, address sender);

    /**
     * @dev Emitted when decrease agent credit
     */
    event AgentDecreaseCredit(address indexed account, uint256 credit, address sender);

    /**
     * @dev Emitted when change agent effective time
     */
    event AgentChangeEffectiveTime(address indexed account, uint256 effectiveTime, address sender);

    /**
     * @dev Emitted when change agent expiration time
     */
    event AgentChangeExpirationTime(address indexed account, uint256 expirationTime, address sender);

    /**
     * @dev Emitted when switch agent minable
     */
    event AgentSwitchMinable(address indexed account, bool minable, address sender);

    /**
     * @dev Emitted when switch agent burnable
     */
    event AgentSwitchBurnable(address indexed account, bool burnable, address sender);

    /**
     * @dev Return agent max credit
     */
    function getMaxCredit(address account) external view returns (uint256);

    /**
     * @dev Return agent remaining credit
     */
    function getRemainingCredit(address account) external view returns (uint256);

    /**
     * @dev Return agent minable status
     */
    function isMinable(address account) external view returns (bool);

    /**
     * @dev Return agent burnable status
     */
    function isBurnable(address account) external view returns (bool);

    /**
     * @dev Return agent effective time
     */
    function getEffectiveTime(address account) external view returns (uint256);

    /**
     * @dev Return agent expiration time
     */
    function getExpirationTime(address account) external view returns (uint256);

    /**
     * @dev Return whether the address is an agent
     */
    function hasAgent(address account) external view returns (bool);

    /**
     * @dev Grant the address as agent
     */
    function grantAgent(
        address account,
        uint256 credit,
        uint256 effectiveTime,
        uint256 expirationTime,
        bool minable,
        bool burnable
    ) external;

    /**
     * @dev Revoke the agent at the address
     */
    function revokeAgent(address account) external;

    /**
     * @dev Change the effective time of the address agent
     */
    function changeEffectiveTime(address account, uint256 effectiveTime) external;

    /**
     * @dev Change the expiration time of the address agent
     */
    function changeExpirationTime(address account, uint256 expirationTime) external;

    /**
     * @dev Change the minable status of the address agent
     */
    function switchMinable(address account, bool minable) external;

    /**
     * @dev Change the burnable status of the address agent
     */
    function switchBurnable(address account, bool burnable) external;

    /**
     * @dev Increase credit of the address agent
     */
    function increaseCredit(address account, uint256 credit) external;

    /**
     * @dev Decrease credit of the address agent
     */
    function decreaseCredit(address account, uint256 credit) external;
}
