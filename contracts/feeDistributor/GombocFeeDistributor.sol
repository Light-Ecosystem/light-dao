// SPDX-License-Identifier: LGPL-3.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IGombocFeeDistributor.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";

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

contract GombocFeeDistributor is Ownable2StepUpgradeable, PausableUpgradeable, IGombocFeeDistributor {
    uint256 constant WEEK = 7 * 86400;
    uint256 constant TOKEN_CHECKPOINT_DEADLINE = 86400;

    uint256 public start_time;
    uint256 public time_cursor;

    /// gombocAddress => userAddress => timeCursor
    mapping(address => mapping(address => uint256)) public time_cursor_of;
    /// gombocAddress => userAddress => epoch
    mapping(address => mapping(address => uint256)) user_epoch_of;

    /// lastTokenTime
    uint256 public last_token_time;
    /// tokensPreWeek
    uint256[1000000000000000] tokens_per_week;

    address public token;
    uint256 public token_last_balance;
    address public stakingGomboc;
    address public gombocController;

    // gombocAddress => VE total supply at week bounds
    mapping(address => uint256[1000000000000000]) public ve_supply;

    bool public can_checkpoint_token;
    address public emergency_return;

    /**
     * @notice Contract constructor
     * @param _stakingGomboc Gomboc contract address
     * @param _gombocController GombocController contract address
     * @param _start_time Epoch time for fee distribution to start
     * @param _token Fee token address list
     * @param _emergency_return Address to transfer `_token` balance to if this contract is killed
     */
    constructor(address _stakingGomboc, address _gombocController, uint256 _start_time, address _token, address _emergency_return) {
        __Ownable2Step_init();

        uint256 t = (_start_time / WEEK) * WEEK;
        start_time = t;
        last_token_time = t;

        time_cursor = t;
        stakingGomboc = _stakingGomboc;
        gombocController = _gombocController;
        emergency_return = _emergency_return;
    }

    /**
     * @notice Update the token checkpoint
     * @dev Calculates the total number of tokens to be distributed in a given week.
         During setup for the initial distribution this function is only callable
         by the contract owner. Beyond initial distro, it can be enabled for anyone
         to call
     */
    function checkpoint_token() external {
        require(
            (msg.sender == owner()) || (can_checkpoint_token && (block.timestamp > last_token_time + TOKEN_CHECKPOINT_DEADLINE)),
            "can not checkpoint now"
        );
        _checkpoint_token();
    }

    function _checkpoint_token() internal {
        uint256 token_balance = IERC20Upgradeable(token).balanceOf(address(this));
        uint256 to_distribute = token_balance - token_last_balance;
        token_last_balance = token_balance;

        uint256 t = last_token_time;
        uint256 since_last = block.timestamp - t;
        last_token_time = block.timestamp;
        uint256 this_week = (t / WEEK) * WEEK;
        uint256 next_week = 0;

        for (uint i = 0; i < 20; i++) {
            next_week = this_week + WEEK;
            if (block.timestamp < next_week) {
                if (since_last == 0 && block.timestamp == t) {
                    tokens_per_week[this_week] += to_distribute;
                } else {
                    tokens_per_week[this_week] += (to_distribute * (block.timestamp - t)) / since_last;
                }
                break;
            } else {
                if (since_last == 0 && next_week == t) {
                    tokens_per_week[this_week] += to_distribute;
                } else {
                    tokens_per_week[this_week] += (to_distribute * (next_week - t)) / since_last;
                }
            }
            t = next_week;
            this_week = next_week;
        }
        emit CheckpointToken(block.timestamp, to_distribute);
    }

    /**
     * @notice Get the veLT balance for `_user` at `_timestamp`
     * @param _gomboc Address to query voting gomboc
     * @param _user Address to query voting amount
     * @param _timestamp Epoch time
     * @return uint256 veLT balance
     */
    function ve_for_at(address _gomboc, address _user, uint256 _timestamp) external view returns (uint256) {
        uint256 max_user_epoch = IGombocController(gombocController).lastVoteVeLtPointEpoch(_user, _gomboc);
        uint256 epoch = _find_timestamp_user_epoch(_gomboc, _user, _timestamp, max_user_epoch);
        Point memory pt = IGombocController(gombocController).voteVeLtPointHistory(_user, _gomboc, epoch);
        return Math.max(uint256(pt.bias) - uint256(pt.slope) * (_timestamp - pt.ts), 0);
    }

    function _find_timestamp_user_epoch(
        address _gomboc,
        address user,
        uint256 _timestamp,
        uint256 max_user_epoch
    ) internal view returns (uint256) {
        uint256 _min = 0;
        uint256 _max = max_user_epoch;
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

    function _claim(address gomboc, address addr, uint256 _last_token_time) internal returns (uint256) {
        ///Minimal user_epoch is 0 (if user had no point)
        uint256 user_epoch = 0;
        uint256 to_distribute = 0;

        uint256 max_user_epoch = IGombocController(gombocController).lastVoteVeLtPointEpoch(addr, gomboc);
        uint256 _start_time = start_time;
        if (max_user_epoch == 0) {
            /// No lock = no fees
            return 0;
        }

        uint256 week_cursor = time_cursor_of[gomboc][addr];
        if (week_cursor == 0) {
            /// Need to do the initial binary search
            user_epoch = _find_timestamp_user_epoch(gomboc, addr, _start_time, max_user_epoch);
        } else {
            user_epoch = user_epoch_of[gomboc][addr];
        }

        if (user_epoch == 0) {
            user_epoch = 1;
        }

        Point memory user_point = IGombocController(gombocController).voteVeLtPointHistory(addr, gomboc, user_epoch);
        if (week_cursor == 0) {
            week_cursor = ((user_point.ts + WEEK - 1) / WEEK) * WEEK;
        }

        if (week_cursor >= _last_token_time) {
            return 0;
        }

        if (week_cursor < _start_time) {
            week_cursor = _start_time;
        }
        Point memory old_user_point = Point({bias: 0, slope: 0, ts: 0, blk: 0});

        /// Iterate over weeks
        for (int i = 0; i < 50; i++) {
            if (week_cursor >= _last_token_time) {
                break;
            }
            if (week_cursor >= user_point.ts && user_epoch <= max_user_epoch) {
                user_epoch += 1;
                old_user_point = user_point;
                if (user_epoch > max_user_epoch) {
                    user_point = Point({bias: 0, slope: 0, ts: 0, blk: 0});
                } else {
                    user_point = IGombocController(gombocController).voteVeLtPointHistory(addr, gomboc, user_epoch);
                }
            } else {
                // Calc
                // + i * 2 is for rounding errors
                uint256 dt = week_cursor - old_user_point.ts;
                uint256 balance_of = Math.max(uint256(old_user_point.bias) - dt * uint256(old_user_point.slope), 0);
                if (balance_of == 0 && user_epoch > max_user_epoch) {
                    break;
                }
                if (balance_of > 0) {
                    SimplePoint memory pt = IGombocController(gombocController).pointsWeight(gomboc, week_cursor);
                    uint256 relativeWeight = IGombocController(gombocController).gombocRelativeWeight(gomboc, week_cursor);
                    to_distribute += (((balance_of * tokens_per_week[week_cursor]) / pt.bias) * relativeWeight) / 1e18;
                }
                week_cursor += WEEK;
            }
        }

        user_epoch = Math.min(max_user_epoch, user_epoch - 1);
        user_epoch_of[gomboc][addr] = user_epoch;
        time_cursor_of[gomboc][addr] = week_cursor;

        emit Claimed(gomboc, addr, to_distribute, user_epoch, max_user_epoch);

        return to_distribute;
    }

    /**
     * @notice Claim fees for `_addr`
     *  @dev Each call to claim look at a maximum of 50 user veCRV points.
         For accounts with many veCRV related actions, this function
         may need to be called more than once to claim all available
         fees. In the `Claimed` event that fires, if `claim_epoch` is
         less than `max_epoch`, the account may claim again.
         @param _addr Address to claim fees token
         @param _addr Address to claim fees for
         @return uint256 Amount of fees claimed in the call
     *
     */
    function claim(address gomboc, address _addr) external whenNotPaused returns (uint256) {
        return _doClaim(gomboc, _addr);
    }

    function _doClaim(address gomboc, address _addr) internal returns (uint256) {
        if (_addr == address(0)) {
            _addr = msg.sender;
        }
        uint256 _last_token_time = last_token_time;
        if (can_checkpoint_token && (block.timestamp > _last_token_time + TOKEN_CHECKPOINT_DEADLINE)) {
            _checkpoint_token();
            _last_token_time = block.timestamp;
        }

        _last_token_time = (_last_token_time / WEEK) * WEEK;
        uint256 amount = _claim(gomboc, _addr, _last_token_time);
        if (amount != 0) {
            IERC20Upgradeable(token).transfer(_addr, amount);
            token_last_balance -= amount;
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
    function claim_many(address gomboc, address[] memory _receivers) external whenNotPaused returns (uint256) {
        uint256 _last_token_time = last_token_time;

        if (can_checkpoint_token && (block.timestamp > _last_token_time + TOKEN_CHECKPOINT_DEADLINE)) {
            _checkpoint_token();
            _last_token_time = block.timestamp;
        }

        _last_token_time = (_last_token_time / WEEK) * WEEK;
        uint256 total = 0;

        for (uint256 i = 0; i < _receivers.length; i++) {
            address addr = _receivers[i];
            if (addr == address(0)) {
                break;
            }
            uint256 amount = _claim(gomboc, addr, _last_token_time);
            if (amount != 0) {
                IERC20Upgradeable(token).transfer(addr, amount);
                total += amount;
            }

            if (total != 0) {
                token_last_balance -= total;
            }
        }

        return total;
    }

    /**
     * @notice Toggle permission for checkpointing by any account
     */
    function toggle_allow_checkpoint_token() external onlyOwner {
        bool flag = !can_checkpoint_token;
        can_checkpoint_token = !can_checkpoint_token;
        emit ToggleAllowCheckpointToken(flag);
    }

    /**
     * @notice Recover ERC20 tokens from this contract
     * @dev Tokens are sent to the emergency return address.
     * @param tokenAddress Token address
     * @return bool success
     */
    function recover_balance(address tokenAddress) external onlyOwner returns (bool) {
        uint256 amount = IERC20Upgradeable(tokenAddress).balanceOf(address(this));
        TransferHelper.doTransferOut(tokenAddress, emergency_return, amount);
        return true;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
