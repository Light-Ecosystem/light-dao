// SPDX-License-Identifier: LGPL-3.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IGombocFeeDistributor.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";
import "light-lib/contracts/LibTime.sol";

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

interface StakingHOPE {
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
    mapping(address => mapping(address => uint256)) userEpochOf;

    /// lastTokenTime
    uint256 public lastTokenTime;
    /// tokensPreWeek
    uint256[1000000000000000] tokensPerWeek;

    ///HOPE Token address
    address public token;
    /// staking hope address
    address public stHOPE;
    uint256 public tokenLastBalance;
    address public stakingGomboc;
    address public gombocController;

    // gombocAddress => VE total supply at week bounds
    mapping(address => uint256[1000000000000000]) public veSupply;

    bool public canCheckpointToken;
    address public emergencyReturn;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Contract constructor
     * @param _stakingGomboc Gomboc contract address
     * @param _gombocController GombocController contract address
     * @param _startTime Epoch time for fee distribution to start
     * @param _token Fee token address list
     * @param _stHOPE stakingHOPE  address
     * @param _emergencyReturn Address to transfer `_token` balance to if this contract is killed
     */
    function initialize(
        address _stakingGomboc,
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
        stakingGomboc = _stakingGomboc;
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
        require(
            (msg.sender == owner()) || (canCheckpointToken && (block.timestamp > lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)),
            "can not checkpoint now"
        );
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

    function _claim(address gomboc, address addr, uint256 _lastTokenTime) internal returns (uint256) {
        ///Minimal userEpoch is 0 (if user had no point)
        uint256 userEpoch = 0;
        uint256 toDistribute = 0;

        uint256 maxUserEpoch = IGombocController(gombocController).lastVoteVeLtPointEpoch(addr, gomboc);
        uint256 _startTime = startTime;
        if (maxUserEpoch == 0) {
            /// No lock = no fees
            return 0;
        }

        uint256 weekCursor = timeCursorOf[gomboc][addr];
        if (weekCursor == 0) {
            /// Need to do the initial binary search
            userEpoch = _findTimestampUserEpoch(gomboc, addr, _startTime, maxUserEpoch);
        } else {
            userEpoch = userEpochOf[gomboc][addr];
        }

        if (userEpoch == 0) {
            userEpoch = 1;
        }

        Point memory userPoint = IGombocController(gombocController).voteVeLtPointHistory(addr, gomboc, userEpoch);
        if (weekCursor == 0) {
            weekCursor = LibTime.timesRoundedByWeek(userPoint.ts + WEEK - 1);
        }

        if (weekCursor >= _lastTokenTime) {
            return 0;
        }

        if (weekCursor < _startTime) {
            weekCursor = _startTime;
        }
        Point memory oldUserPoint = Point({bias: 0, slope: 0, ts: 0, blk: 0});

        /// Iterate over weeks
        for (int i = 0; i < 50; i++) {
            if (weekCursor >= _lastTokenTime) {
                break;
            }
            if (weekCursor >= userPoint.ts && userEpoch <= maxUserEpoch) {
                userEpoch += 1;
                oldUserPoint = userPoint;
                if (userEpoch > maxUserEpoch) {
                    userPoint = Point({bias: 0, slope: 0, ts: 0, blk: 0});
                } else {
                    userPoint = IGombocController(gombocController).voteVeLtPointHistory(addr, gomboc, userEpoch);
                }
            } else {
                // Calc
                // + i * 2 is for rounding errors
                uint256 dt = weekCursor - oldUserPoint.ts;
                uint256 balanceOf = Math.max(uint256(oldUserPoint.bias) - dt * uint256(oldUserPoint.slope), 0);
                if (balanceOf == 0 && userEpoch > maxUserEpoch) {
                    break;
                }
                if (balanceOf > 0) {
                    SimplePoint memory pt = IGombocController(gombocController).pointsWeight(gomboc, weekCursor);
                    uint256 relativeWeight = IGombocController(gombocController).gombocRelativeWeight(gomboc, weekCursor);
                    toDistribute += (((balanceOf * tokensPerWeek[weekCursor]) / pt.bias) * relativeWeight) / 1e18;
                }
                weekCursor += WEEK;
            }
        }

        userEpoch = Math.min(maxUserEpoch, userEpoch - 1);
        userEpochOf[gomboc][addr] = userEpoch;
        timeCursorOf[gomboc][addr] = weekCursor;

        emit Claimed(gomboc, addr, toDistribute, userEpoch, maxUserEpoch);

        return toDistribute;
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
     * @param _receivers List of addresses to claim for. Claiming terminates at the first `ZERO_ADDRESS`.
     * @return uint256 claim totol fee
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

            if (total != 0) {
                tokenLastBalance -= total;
            }
        }

        return total;
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
        return true;
    }

    function stakingHOPEAndTransfer2User(address to, uint256 amount) internal {
        StakingHOPE(stHOPE).staking(amount, 0, 0, "");
        TransferHelper.doTransferOut(stHOPE, to, amount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
