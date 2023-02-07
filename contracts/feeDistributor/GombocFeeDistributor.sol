// SPDX-License-Identifier: LGPL-3.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IGombocFeeDistributor.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import "light-lib/contracts/LibTime.sol";
import "hardhat/console.sol";

struct Point {
    int256 bias;
    int256 slope;
    uint256 ts;
    uint256 blk;
}

struct SimplePoint {
    uint256 bias;
    uint256 slope;
}

interface IGombocController {
    function lastVoteVeLtPointEpoch(address user, address gomboc) external view returns (uint256);

    function pointsWeight(address gomboc, uint256 time) external view returns (SimplePoint memory);

    function voteVeLtPointHistory(address user, address gomboc, uint256 epoch) external view returns (Point memory);

    function gombocRelativeWeight(address gombocAddress, uint256 time) external view returns (uint256);
}

interface IStakingHOPE {
    function staking(uint256 amount, uint256 nonce, uint256 deadline, bytes memory signature) external;
}

contract GombocFeeDistributor is Ownable2StepUpgradeable, PausableUpgradeable, IGombocFeeDistributor {
    uint256 constant WEEK = 7 * 86400;
    uint256 constant TOKEN_CHECKPOINT_DEADLINE = 86400;

    uint256 public startTime;
    uint256 public timeCursor;

    /// gombocAddress => userAddress => timeCursor
    mapping(address => mapping(address => uint256)) public timeCursorOf;
    /// gombocAddress => userAddress => epoch
    mapping(address => mapping(address => uint256)) public userEpochOf;

    /// lastTokenTime
    uint256 public lastTokenTime;
    /// tokensPreWeek
    mapping(uint256 => uint256) public tokensPerWeek;

    ///HOPE Token address
    address public token;
    /// staking hope address
    address public stHOPE;
    uint256 public tokenLastBalance;
    address public gombocController;

    bool public canCheckpointToken;
    address public emergencyReturn;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Contract constructor
     * @param _gombocController GombocController contract address
     * @param _startTime Epoch time for fee distribution to start
     * @param _token Fee token address list
     * @param _stHOPE stakingHOPE  address
     * @param _emergencyReturn Address to transfer `_token` balance to if this contract is killed
     */
    function initialize(
        address _gombocController,
        uint256 _startTime,
        address _token,
        address _stHOPE,
        address _emergencyReturn
    ) external initializer {
        __Ownable2Step_init();

        uint256 t = LibTime.timesRoundedByWeek(_startTime);
        startTime = t;
        lastTokenTime = t;

        token = _token;
        stHOPE = _stHOPE;
        timeCursor = t;
        gombocController = _gombocController;
        emergencyReturn = _emergencyReturn;
    }

    /**
     * @notice Update the token checkpoint
     * @dev Calculates the total number of tokens to be distributed in a given week.
         During setup for the initial distribution this function is only callable
         by the contract owner. Beyond initial distro, it can be enabled for anyone
         to call
     */
    function checkpointToken() external {
        require((msg.sender == owner()) || (canCheckpointToken && (block.timestamp > lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)), "FD001");
        _checkpointToken();
    }

    function _checkpointToken() internal {
        uint256 tokenBalance = IERC20Upgradeable(token).balanceOf(address(this));
        uint256 toDistribute = tokenBalance - tokenLastBalance;
        tokenLastBalance = tokenBalance;

        uint256 t = lastTokenTime;
        uint256 sinceLast = block.timestamp - t;
        lastTokenTime = block.timestamp;
        uint256 thisWeek = LibTime.timesRoundedByWeek(t);
        uint256 nextWeek = 0;

        for (uint i = 0; i < 20; i++) {
            nextWeek = thisWeek + WEEK;
            if (block.timestamp < nextWeek) {
                if (sinceLast == 0 && block.timestamp == t) {
                    tokensPerWeek[thisWeek] += toDistribute;
                } else {
                    tokensPerWeek[thisWeek] += (toDistribute * (block.timestamp - t)) / sinceLast;
                }
                break;
            } else {
                if (sinceLast == 0 && nextWeek == t) {
                    tokensPerWeek[thisWeek] += toDistribute;
                } else {
                    tokensPerWeek[thisWeek] += (toDistribute * (nextWeek - t)) / sinceLast;
                }
            }
            t = nextWeek;
            thisWeek = nextWeek;
        }
        emit CheckpointToken(block.timestamp, toDistribute);
    }

    /**
     * @notice Get the veLT balance for `_user` at `_timestamp`
     * @param _gomboc Address to query voting gomboc
     * @param _user Address to query voting amount
     * @param _timestamp Epoch time
     * @return uint256 veLT balance
     */
    function veForAt(address _gomboc, address _user, uint256 _timestamp) external view returns (uint256) {
        uint256 maxUserEpoch = IGombocController(gombocController).lastVoteVeLtPointEpoch(_user, _gomboc);
        uint256 epoch = _findTimestampUserEpoch(_gomboc, _user, _timestamp, maxUserEpoch);
        Point memory pt = IGombocController(gombocController).voteVeLtPointHistory(_user, _gomboc, epoch);
        return Math.max(uint256(pt.bias) - uint256(pt.slope) * (_timestamp - pt.ts), 0);
    }

    /**
     * @notice Get the VeLT voting percentage for `_user` in _gomboc  at `_timestamp`
     * @param _gomboc Address to query voting gomboc
     * @param _user Address to query voting
     * @param _timestamp Epoch time
     * @return value of voting precentage normalized to 1e18
     */
    function vePrecentageForAt(address _gomboc, address _user, uint256 _timestamp) external view returns (uint256) {
        _timestamp = LibTime.timesRoundedByWeek(_timestamp);
        uint256 veForAtValue = this.veForAt(_gomboc, _user, _timestamp);
        SimplePoint memory pt = IGombocController(gombocController).pointsWeight(_gomboc, _timestamp);
        return (veForAtValue * 1e18) / pt.bias;
    }

    /**
     * @notice Get the HOPE balance for _gomboc  at `_weekCursor`
     * @param _gomboc Address to query voting gomboc
     * @param _weekCursor week cursor
     */
    function gombocBalancePreWeek(address _gomboc, uint256 _weekCursor) external view returns (uint256) {
        _weekCursor = LibTime.timesRoundedByWeek(_weekCursor);
        uint256 relativeWeight = IGombocController(gombocController).gombocRelativeWeight(_gomboc, _weekCursor - WEEK);
        return (tokensPerWeek[_weekCursor] * relativeWeight) / 1e18;
    }

    function _findTimestampUserEpoch(
        address _gomboc,
        address user,
        uint256 _timestamp,
        uint256 maxUserEpoch
    ) internal view returns (uint256) {
        uint256 _min = 0;
        uint256 _max = maxUserEpoch;
        for (int i = 0; i < 128; i++) {
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 2) / 2;
            Point memory pt = IGombocController(gombocController).voteVeLtPointHistory(user, _gomboc, _mid);
            if (pt.ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /// avalid deep stack
    struct ClaimParam {
        uint256 userEpoch;
        uint256 toDistribute;
        uint256 maxUserEpoch;
        uint256 weekCursor;
        Point userPoint;
        Point oldUserPoint;
    }

    function _claim(address gomboc, address addr, uint256 _lastTokenTime) internal returns (uint256) {
        ClaimParam memory param;

        ///Minimal userEpoch is 0 (if user had no point)
        param.userEpoch = 0;
        param.toDistribute = 0;

        param.maxUserEpoch = IGombocController(gombocController).lastVoteVeLtPointEpoch(addr, gomboc);
        uint256 _startTime = startTime;
        if (param.maxUserEpoch == 0) {
            /// No lock = no fees
            return 0;
        }

        param.weekCursor = timeCursorOf[gomboc][addr];
        if (param.weekCursor == 0) {
            /// Need to do the initial binary search
            param.userEpoch = _findTimestampUserEpoch(gomboc, addr, _startTime, param.maxUserEpoch);
        } else {
            param.userEpoch = userEpochOf[gomboc][addr];
        }
        if (param.userEpoch == 0) {
            param.userEpoch = 1;
        }

        param.userPoint = IGombocController(gombocController).voteVeLtPointHistory(addr, gomboc, param.userEpoch);
        if (param.weekCursor == 0) {
            param.weekCursor = LibTime.timesRoundedByWeek(param.userPoint.ts + WEEK - 1);
        }

        if (param.weekCursor >= _lastTokenTime) {
            return 0;
        }

        if (param.weekCursor < _startTime) {
            param.weekCursor = _startTime;
        }
        param.oldUserPoint = Point({bias: 0, slope: 0, ts: 0, blk: 0});

        /// Iterate over weeks
        for (int i = 0; i < 50; i++) {
            if (param.weekCursor >= _lastTokenTime) {
                break;
            }
            uint gombocTime = param.weekCursor - WEEK;
            if (gombocTime >= param.userPoint.ts && param.userEpoch <= param.maxUserEpoch) {
                param.userEpoch += 1;
                param.oldUserPoint = param.userPoint;
                if (param.userEpoch > param.maxUserEpoch) {
                    param.userPoint = Point({bias: 0, slope: 0, ts: 0, blk: 0});
                } else {
                    param.userPoint = IGombocController(gombocController).voteVeLtPointHistory(addr, gomboc, param.userEpoch);
                }
            } else {
                // Calc
                // + i * 2 is for rounding errors
                uint256 dt = gombocTime - param.oldUserPoint.ts;
                uint256 balanceOf = Math.max(uint256(param.oldUserPoint.bias) - dt * uint256(param.oldUserPoint.slope), 0);
                if (balanceOf == 0 && param.userEpoch > param.maxUserEpoch) {
                    break;
                }
                if (balanceOf > 0) {
                    SimplePoint memory pt = IGombocController(gombocController).pointsWeight(gomboc, gombocTime);
                    uint256 relativeWeight = IGombocController(gombocController).gombocRelativeWeight(gomboc, gombocTime);
                    param.toDistribute += ((balanceOf * tokensPerWeek[param.weekCursor] * relativeWeight) / pt.bias) / 1e18;
                }
                param.weekCursor += WEEK;
            }
        }

        param.userEpoch = Math.min(param.maxUserEpoch, param.userEpoch - 1);
        userEpochOf[gomboc][addr] = param.userEpoch;
        timeCursorOf[gomboc][addr] = param.weekCursor;

        emit Claimed(gomboc, addr, param.toDistribute, param.userEpoch, param.maxUserEpoch);

        return param.toDistribute;
    }

    /**
     * @notice Claim fees for `_addr`
     *  @dev Each call to claim look at a maximum of 50 user veCRV points.
         For accounts with many veCRV related actions, this function
         may need to be called more than once to claim all available
         fees. In the `Claimed` event that fires, if `claim_epoch` is
         less than `max_epoch`, the account may claim again.
         @param gomboc Address to claim fee of gomboc
         @param _addr Address to claim fees for
         @return uint256 Amount of fees claimed in the call
     *
     */
    function claim(address gomboc, address _addr) external whenNotPaused returns (uint256) {
        if (_addr == address(0)) {
            _addr = msg.sender;
        }
        uint256 _lastTokenTime = lastTokenTime;
        if (canCheckpointToken && (block.timestamp > _lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)) {
            _checkpointToken();
            _lastTokenTime = block.timestamp;
        }

        _lastTokenTime = LibTime.timesRoundedByWeek(_lastTokenTime);
        uint256 amount = _claim(gomboc, _addr, _lastTokenTime);
        if (amount != 0) {
            stakingHOPEAndTransfer2User(_addr, amount);
            tokenLastBalance -= amount;
        }
        return amount;
    }

    /**
     * @notice Make multiple fee claims in a single call
     * @dev Used to claim for many accounts at once, or to make
         multiple claims for the same address when that address
         has significant veLT history
       @param  gomboc  Address to claim fee of gomboc
     * @param _receivers List of addresses to claim for. Claiming terminates at the first `ZERO_ADDRESS`.
     * @return uint256 claim total fee
     */
    function claimMany(address gomboc, address[] memory _receivers) external whenNotPaused returns (uint256) {
        uint256 _lastTokenTime = lastTokenTime;

        if (canCheckpointToken && (block.timestamp > _lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)) {
            _checkpointToken();
            _lastTokenTime = block.timestamp;
        }

        _lastTokenTime = LibTime.timesRoundedByWeek(_lastTokenTime);
        uint256 total = 0;

        for (uint256 i = 0; i < _receivers.length; i++) {
            address addr = _receivers[i];
            if (addr == address(0)) {
                break;
            }
            uint256 amount = _claim(gomboc, addr, _lastTokenTime);
            if (amount != 0) {
                stakingHOPEAndTransfer2User(addr, amount);
                total += amount;
            }
        }

        if (total != 0) {
            tokenLastBalance -= total;
        }

        return total;
    }

    /**
     * @notice Make multiple fee claims in a single call
     * @dev Used to claim for many accounts at once, or to make
         multiple claims for the same address when that address
         has significant veLT history
       @param  gombocList  List of gombocs to claim
     * @param receiver address to claim for.
     * @return uint256 claim total fee
     */
    function claimManyGomboc(address[] memory gombocList, address receiver) external whenNotPaused returns (uint256) {
        uint256 _lastTokenTime = lastTokenTime;

        if (canCheckpointToken && (block.timestamp > _lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)) {
            _checkpointToken();
            _lastTokenTime = block.timestamp;
        }

        _lastTokenTime = LibTime.timesRoundedByWeek(_lastTokenTime);
        uint256 total = 0;

        for (uint256 i = 0; i < gombocList.length; i++) {
            address gomboc = gombocList[i];
            if (gomboc == address(0)) {
                break;
            }
            uint256 amount = _claim(gomboc, receiver, _lastTokenTime);
            if (amount != 0) {
                total += amount;
            }
        }

        if (total != 0) {
            tokenLastBalance -= total;
            stakingHOPEAndTransfer2User(receiver, total);
        }

        return total;
    }

    /**
     * @notice Receive HOPE into the contract and trigger a token checkpoint
     * @param amount burn amount
     * @return bool success
     */
    function burn(uint256 amount) external whenNotPaused returns (bool) {
        if (amount != 0) {
            require(IERC20Upgradeable(token).transferFrom(msg.sender, address(this), amount), "TRANSFER_FROM_FAILED");
            if (canCheckpointToken && (block.timestamp > lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)) {
                _checkpointToken();
            }
        }
        return true;
    }

    /**
     * @notice Toggle permission for checkpointing by any account
     */
    function toggleAllowCheckpointToken() external onlyOwner {
        bool flag = !canCheckpointToken;
        canCheckpointToken = !canCheckpointToken;
        emit ToggleAllowCheckpointToken(flag);
    }

    /**
     * @notice Recover ERC20 tokens from this contract
     * @dev Tokens are sent to the emergency return address.
     * @return bool success
     */
    function recoverBalance() external onlyOwner returns (bool) {
        uint256 amount = IERC20Upgradeable(token).balanceOf(address(this));
        TransferHelper.doTransferOut(token, emergencyReturn, amount);
        emit RecoverBalance(token, emergencyReturn, amount);
        return true;
    }

    /**
     * @notice Set the token emergency return address
     * @param _addr emergencyReturn address
     */
    function setEmergencyReturn(address _addr) external onlyOwner {
        emergencyReturn = _addr;
    }

    function stakingHOPEAndTransfer2User(address to, uint256 amount) internal {
        require(IERC20Upgradeable(token).approve(stHOPE, amount), "APPROVE_FAILED");
        IStakingHOPE(stHOPE).staking(amount, 0, 0, "");
        TransferHelper.doTransferOut(stHOPE, to, amount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
