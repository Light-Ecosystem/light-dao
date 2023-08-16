// SPDX-License-Identifier: LGPL-3.0

pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";

interface IStakingHOPE {
    function staking(uint256 amount, uint256 nonce, uint256 deadline, bytes memory signature) external returns (bool);
}

interface IMinter {
    function mint(address gaugeAddress) external;
}

contract StHOPERewardVault is Ownable2StepUpgradeable, AccessControlUpgradeable {
    bytes32 public constant OPERATOR_ROLE = keccak256("Operator_Role");

    ///HOPE Token address
    address public HOPE;
    /// staking hope address
    address public stHOPE;
    /// minter address
    address public minter;
    /// singer address
    address public signer;
    /// nonce for claim
    mapping(address => uint256) public nonces;

    event Fund(address indexed operator, uint256 amount, uint256 timestamp);
    event Claim(address user, uint256 amount, uint256 nonce, uint256 rewardPerShare, uint256 lastUpdateTime, uint256 totalClaimable);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param _HOPE HOPE Token Address
     * @param _stHOPE staking HOPE Token Address
     * @param _minter minter address
     * @param _singer singer address
     */
    function initialize(address _HOPE, address _stHOPE, address _minter, address _singer) public initializer {
        require(_HOPE != address(0), "Invalid Address");
        require(_stHOPE != address(0), "Invalid Address");

        __Ownable2Step_init();

        HOPE = _HOPE;
        stHOPE = _stHOPE;
        minter = _minter;
        signer = _singer;
    }

    /**
     * @notice Fund the vault
     * @param _amount amount to fund
     */
    function fund(uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        TransferHelper.doTransferFrom(HOPE, msg.sender, address(this), _amount);
        _stakingHOPE(_amount);

        emit Fund(msg.sender, _amount, block.timestamp);
    }

    /**
     * @notice Claim rewards
     * @param _signature signature
     * @param _amount amount to claim
     * @param _deadline deadline
     * @param _rewardPerShare the rewardPerShare when claim
     * @param _lastUpdateTime claim time
     * @param _totalClaimable the user total claimable
     */
    function claimRewards(
        bytes calldata _signature,
        uint256 _amount,
        uint256 _deadline,
        uint256 _rewardPerShare,
        uint256 _lastUpdateTime,
        uint256 _totalClaimable
    ) external {
        require(_deadline >= block.timestamp, "Signature Expired");
        nonces[msg.sender] = nonces[msg.sender] + 1;
        bool success = _verifySignature(
            msg.sender,
            _amount,
            nonces[msg.sender],
            _deadline,
            block.chainid,
            _rewardPerShare,
            _lastUpdateTime,
            _totalClaimable,
            _signature
        );
        require(success, "Invalid Signature");

        TransferHelper.doTransferOut(stHOPE, msg.sender, _amount);

        emit Claim(msg.sender, _amount, nonces[msg.sender], _rewardPerShare, _lastUpdateTime, _totalClaimable);
    }

    /**
     * @notice Verify signature
     * @param _account account
     * @param _amount amount to claim
     * @param _nonce the user nonce
     * @param _deadline deadline
     * @param chainId chainId
     * @param _rewardPerShare the rewardPerShare when claim
     * @param _lastUpdateTime claim time
     * @param _totalClaimable the user total claimable
     * @param _signature signature
     */
    function _verifySignature(
        address _account,
        uint256 _amount,
        uint256 _nonce,
        uint256 _deadline,
        uint256 chainId,
        uint256 _rewardPerShare,
        uint256 _lastUpdateTime,
        uint256 _totalClaimable,
        bytes memory _signature
    ) internal view returns (bool) {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encodePacked(_account, _amount, _nonce, _deadline, chainId, _rewardPerShare, _lastUpdateTime, _totalClaimable)
                )
            )
        );

        return _recoverSigner(ethSignedMessageHash, _signature) == signer;
    }

    /**
     * @notice Recover signer from signature
     * @param _ethSignedMessageHash ethSignedMessageHash
     * @param _signature signature
     */
    function _recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    /**
     * @notice Split signature
     * @param sig signature
     */
    function _splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }

    /**
     * @notice Staking HOPE
     * @param _amount amount to stake
     */
    function _stakingHOPE(uint256 _amount) internal {
        TransferHelper.doApprove(HOPE, stHOPE, _amount);
        bool success = IStakingHOPE(stHOPE).staking(_amount, 0, 0, "");
        require(success, "staking hope fail");
    }

    /**
     * @notice Set minter
     * @param _minter minter address
     */
    function setMinter(address _minter) external onlyRole(OPERATOR_ROLE) {
        require(_minter != address(0), "Invalid Address");
        minter = _minter;
    }

    /**
     * @notice Claim of LT incentives by holding stHOPE
     */
    function claimRewardsFromGauge() external onlyRole(OPERATOR_ROLE) {
        IMinter(minter).mint(stHOPE);
    }

    /**
     * @notice Recover token
     * @param _token token address
     * @param _receiver receiver address
     * @param _amount amount to recover
     */
    function recoverToken(address _token, address _receiver, uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        TransferHelper.doTransferOut(_token, _receiver, _amount);
    }

    /**
     * @notice Check if the address is operator
     * @param _operator operator address
     */
    function isOperator(address _operator) external view returns (bool) {
        return hasRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @notice Add operator
     * @param _operator operator address
     */
    function addOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Zero address not valid");
        _grantRole(OPERATOR_ROLE, _operator);
    }

    /**
     * @notice Remove operator
     * @param _operator operator address
     */
    function removeOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Zero address not valid");
        _revokeRole(OPERATOR_ROLE, _operator);
    }
}
