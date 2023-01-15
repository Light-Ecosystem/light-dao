// SPDX-License-Identifier: LGPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "../interfaces/IAgentManager.sol";

contract AgentManager is IAgentManager, Ownable2StepUpgradeable {
    /**
     * @dev Agent props
     */
    struct AgentProp {
        bool hasAgent;
        uint256 maxCredit;
        uint256 remainingCredit;
        uint256 effectiveTime;
        uint256 expirationTime;
        bool minable;
        bool burnable;
    }

    // agent map
    mapping(address => AgentProp) private _agents;

    modifier onlyAgent() {
        require(hasAgent(msg.sender), "AG000");
        _;
    }

    modifier onlyMinable() {
        require(isMinable(msg.sender), "AG002");
        _;
    }

    modifier onlyBurnable() {
        require(isBurnable(msg.sender), "AG003");
        _;
    }

    /**
     * @dev Return agent max credit
     */
    function getMaxCredit(address account) public view override returns (uint256) {
        require(hasAgent(account), "AG000");
        return _agents[account].maxCredit;
    }

    /**
     * @dev Return agent remaining credit
     * @dev Return zero when the time does not reach the effective time or exceeds the expiration time
     */
    function getRemainingCredit(address account) public view override returns (uint256) {
        require(hasAgent(account), "AG000");
        if (_agents[account].effectiveTime > block.timestamp) {
            return 0;
        }
        if (_agents[account].expirationTime < block.timestamp) {
            return 0;
        }
        return _agents[account].remainingCredit;
    }

    /**
     * @dev Return agent minable status
     */
    function isMinable(address account) public view override returns (bool) {
        require(hasAgent(account), "AG000");
        return _agents[account].minable;
    }

    /**
     * @dev Return agent burnable status
     */
    function isBurnable(address account) public view override returns (bool) {
        require(hasAgent(account), "AG000");
        return _agents[account].burnable;
    }

    /**
     * @dev Return agent effective time
     */
    function getEffectiveTime(address account) public view override returns (uint256) {
        require(hasAgent(account), "AG000");
        return _agents[account].effectiveTime;
    }

    /**
     * @dev Return agent expiration time
     */
    function getExpirationTime(address account) public view override returns (uint256) {
        require(hasAgent(account), "AG000");
        return _agents[account].expirationTime;
    }

    /**
     * @dev Return whether the address is an agent
     */
    function hasAgent(address account) public view override returns (bool) {
        return _agents[account].hasAgent;
    }

    /**
     * @dev Grant the address as agent
     * @dev After setting credit, the max credit and the remaining credit are the same as credit
     * @param account Grant agent address
     * @param credit Grant agent Max credit & Remaining credit
     * @param effectiveTime Agent effective time
     * @param expirationTime Agent expiration time
     * @param minable Agent minable
     * @param burnable Agent burnable
     */
    function grantAgent(
        address account,
        uint256 credit,
        uint256 effectiveTime,
        uint256 expirationTime,
        bool minable,
        bool burnable
    ) public override onlyOwner {
        require(account != address(0), "CE000");
        require(!hasAgent(account), "AG001");
        require(credit > 0, "AG005");
        require(expirationTime > block.timestamp, "AG006");
        require(effectiveTime < expirationTime, "AG015");
        _grantAgent(account, credit, effectiveTime, expirationTime, minable, burnable);
    }

    function _grantAgent(
        address account,
        uint256 credit,
        uint256 effectiveTime,
        uint256 expirationTime,
        bool minable,
        bool burnable
    ) internal {
        _agents[account].hasAgent = true;
        _agents[account].maxCredit = credit;
        _agents[account].remainingCredit = credit;
        _agents[account].effectiveTime = effectiveTime;
        _agents[account].expirationTime = expirationTime;
        _agents[account].minable = minable;
        _agents[account].burnable = burnable;
        emit AgentGranted(account, credit, effectiveTime, expirationTime, minable, burnable, _msgSender());
    }

    /**
     * @dev Revoke the agent at the address
     * @param account Revoke agent address
     */
    function revokeAgent(address account) public override onlyOwner {
        require(account != address(0), "CE000");
        require(hasAgent(account), "AG000");
        _revokeAgent(account);
    }

    function _revokeAgent(address account) internal {
        delete _agents[account];
        emit AgentRevoked(account, _msgSender());
    }

    /**
     * @dev Change the effective time of the address agent
     */
    function changeEffectiveTime(address account, uint256 effectiveTime) public override onlyOwner {
        require(account != address(0), "CE000");
        require(hasAgent(account), "AG000");
        require(effectiveTime < _agents[account].expirationTime, "AG012");
        _agents[account].effectiveTime = effectiveTime;
        emit AgentChangeEffectiveTime(account, effectiveTime, _msgSender());
    }

    /**
     * @dev Change the expiration time of the address agent
     */
    function changeExpirationTime(address account, uint256 expirationTime) public override onlyOwner {
        require(account != address(0), "CE000");
        require(hasAgent(account), "AG000");
        require(expirationTime != _agents[account].expirationTime && expirationTime > block.timestamp, "AG013");
        _agents[account].expirationTime = expirationTime;
        emit AgentChangeExpirationTime(account, expirationTime, _msgSender());
    }

    /**
     * @dev Change the minable status of the address agent
     */
    function switchMinable(address account, bool minable) public override onlyOwner {
        require(account != address(0), "CE000");
        require(hasAgent(account), "AG000");
        require(minable != _agents[account].minable, "AG010");
        _agents[account].minable = minable;
        emit AgentSwitchMinable(account, minable, _msgSender());
    }

    /**
     * @dev Change the burnable status of the address agent
     */
    function switchBurnable(address account, bool burnable) public override onlyOwner {
        require(account != address(0), "CE000");
        require(hasAgent(account), "AG000");
        require(burnable != _agents[account].burnable, "AG010");
        _agents[account].burnable = burnable;
        emit AgentSwitchBurnable(account, burnable, _msgSender());
    }

    /**
     * @dev Increase credit of the address agent
     * @dev After increase credit, the max credit and the remaining credit increase simultaneously
     */
    function increaseCredit(address account, uint256 credit) public override onlyOwner {
        require(account != address(0), "CE000");
        require(hasAgent(account), "AG000");
        require(credit > 0, "AG007");
        _agents[account].maxCredit += credit;
        _agents[account].remainingCredit += credit;
        emit AgentIncreaseCredit(account, credit, _msgSender());
    }

    /**
     * @dev Decrease credit of the address agent
     * @dev After decrease credit, the max credit and the remaining credit decrease simultaneously
     */
    function decreaseCredit(address account, uint256 credit) public override onlyOwner {
        require(account != address(0), "CE000");
        require(hasAgent(account), "AG000");
        require(credit > 0, "AG008");
        require(credit <= _agents[account].remainingCredit, "AG009");
        _agents[account].maxCredit -= credit;
        _agents[account].remainingCredit -= credit;
        emit AgentDecreaseCredit(account, credit, _msgSender());
    }

    function _increaseRemainingCredit(address account, uint256 amount) internal {
        if (getRemainingCredit(account) + amount > getMaxCredit(account)) {
            _agents[account].remainingCredit = getMaxCredit(account);
        } else {
            _agents[account].remainingCredit += amount;
        }
    }

    function _decreaseRemainingCredit(address account, uint256 amount) internal {
        _agents[account].remainingCredit -= amount;
    }
}
