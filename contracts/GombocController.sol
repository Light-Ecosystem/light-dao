// SPDX-License-Identifier: LGPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IGombocController.sol";
import "./interfaces/IVotingEscrow.sol";
import "light-lib/contracts/LibTime.sol";

contract GombocController is Ownable2Step, IGombocController {
    // 7 * 86400 seconds - all future times are rounded by week
    uint256 private constant _DAY = 86400;
    uint256 private constant _WEEK = _DAY * 7;
    // Cannot change weight votes more often than once in 10 days
    uint256 private constant _WEIGHT_VOTE_DELAY = 10 * _DAY;

    uint256 private constant _MULTIPLIER = 10 ** 18;

    // lt token
    address public immutable token;
    // veLT token
    address public immutable override votingEscrow;

    // Gomboc parameters
    // All numbers are "fixed point" on the basis of 1e18
    int128 public nGombocTypes;
    int128 public nGomboc;
    mapping(int128 => string) public gombocTypeNames;

    // Needed for enumeration
    address[10000000000] public gombocs;

    // we increment values by 1 prior to storing them here so we can rely on a value
    // of zero as meaning the gomboc has not been set
    mapping(address => int128) private _gombocTypes;

    // user -> gombocAddr -> VotedSlope
    mapping(address => mapping(address => VotedSlope)) public voteUserSlopes;
    // Total vote power used by user
    mapping(address => uint256) public voteUserPower;
    // Last user vote's timestamp for each gomboc address
    mapping(address => mapping(address => uint256)) public lastUserVote;

    // user -> gombocAddr -> epoch -> Point
    mapping(address => mapping(address => mapping(uint256 => UserPoint))) public voteVeLtPointHistory;
    // user -> gombocAddr -> lastEpoch
    mapping(address => mapping(address => uint256)) public lastVoteVeLtPointEpoch;

    // Past and scheduled points for gomboc weight, sum of weights per type, total weight
    // Point is for bias+slope
    // changes_* are for changes in slope
    // time_* are for the last change timestamp
    // timestamps are rounded to whole weeks

    // gombocAddr -> time -> Point
    mapping(address => mapping(uint256 => Point)) public pointsWeight;
    // gombocAddr -> time -> slope
    mapping(address => mapping(uint256 => uint256)) private _changesWeight;
    // gombocAddr -> last scheduled time (next week)
    mapping(address => uint256) public timeWeight;

    //typeId -> time -> Point
    mapping(int128 => mapping(uint256 => Point)) public pointsSum;
    // typeId -> time -> slope
    mapping(int128 => mapping(uint256 => uint256)) public changesSum;
    //typeId -> last scheduled time (next week)
    uint256[1000000000] public timeSum;

    // time -> total weight
    mapping(uint256 => uint256) public pointsTotal;
    // last scheduled time
    uint256 public timeTotal;

    // typeId -> time -> type weight
    mapping(int128 => mapping(uint256 => uint256)) public pointsTypeWeight;
    // typeId -> last scheduled time (next week)
    uint256[1000000000] public timeTypeWeight;

    /**
     * @notice Contract constructor
     * @param tokenAddress  LT contract address
     * @param votingEscrowAddress veLT contract address
     */
    constructor(address tokenAddress, address votingEscrowAddress) {
        require(tokenAddress != address(0), "CE000");
        require(votingEscrowAddress != address(0), "CE000");

        token = tokenAddress;
        votingEscrow = votingEscrowAddress;
        timeTotal = LibTime.timesRoundedByWeek(block.timestamp);
    }

    /**
     * @notice Get gomboc type for address
     *  @param _addr Gomboc address
     * @return Gomboc type id
     */
    function gombocTypes(address _addr) external view override returns (int128) {
        int128 gombocType = _gombocTypes[_addr];
        require(gombocType != 0, "CE000");
        return gombocType - 1;
    }

    /**
     * @notice Add gomboc `addr` of type `gombocType` with weight `weight`
     * @param addr Gomboc address
     * @param gombocType Gomboc type
     * @param weight Gomboc weight
     */
    function addGomboc(address addr, int128 gombocType, uint256 weight) external override onlyOwner {
        require(gombocType >= 0 && gombocType < nGombocTypes, "GC001");
        require(_gombocTypes[addr] == 0, "GC002");

        int128 n = nGomboc;
        nGomboc = n + 1;
        gombocs[_int128ToUint256(n)] = addr;

        _gombocTypes[addr] = gombocType + 1;
        uint256 nextTime = LibTime.timesRoundedByWeek(block.timestamp + _WEEK);

        if (weight > 0) {
            uint256 _typeWeight = _getTypeWeight(gombocType);
            uint256 _oldSum = _getSum(gombocType);
            uint256 _oldTotal = _getTotal();

            pointsSum[gombocType][nextTime].bias = weight + _oldSum;
            timeSum[_int128ToUint256(gombocType)] = nextTime;
            pointsTotal[nextTime] = _oldTotal + _typeWeight * weight;
            timeTotal = nextTime;

            pointsWeight[addr][nextTime].bias = weight;
        }

        if (timeSum[_int128ToUint256(gombocType)] == 0) {
            timeSum[_int128ToUint256(gombocType)] = nextTime;
        }
        timeWeight[addr] = nextTime;

        emit NewGomboc(addr, gombocType, weight);
    }

    /**
     * @notice Checkpoint to fill data common for all gombocs
     */
    function checkpoint() external override {
        _getTotal();
    }

    /**
     * @notice Checkpoint to fill data for both a specific gomboc and common for all gomboc
     * @param addr Gomboc address
     */
    function checkpointGomboc(address addr) external override {
        _getWeight(addr);
        _getTotal();
    }

    /**
     * @notice Get Gomboc relative weight (not more than 1.0) normalized to 1e18(e.g. 1.0 == 1e18). Inflation which will be received by
     * it is inflation_rate * relative_weight / 1e18
     * @param gombocAddress Gomboc address
     * @param time Relative weight at the specified timestamp in the past or present
     * @return Value of relative weight normalized to 1e18
     */
    function gombocRelativeWeight(address gombocAddress, uint256 time) external view override returns (uint256) {
        return _gombocRelativeWeight(gombocAddress, time);
    }

    /**
     *  @notice Get gomboc weight normalized to 1e18 and also fill all the unfilled values for type and gomboc records
     * @dev Any address can call, however nothing is recorded if the values are filled already
     * @param gombocAddress Gomboc address
     * @param time Relative weight at the specified timestamp in the past or present
     * @return Value of relative weight normalized to 1e18
     */
    function gombocRelativeWeightWrite(address gombocAddress, uint256 time) external override returns (uint256) {
        _getWeight(gombocAddress);
        // Also calculates get_sum;
        _getTotal();
        return _gombocRelativeWeight(gombocAddress, time);
    }

    /**
     * @notice Add gomboc type with name `_name` and weight `weight`
     * @dev only owner call
     * @param _name Name of gomboc type
     * @param weight Weight of gomboc type
     */
    function addType(string memory _name, uint256 weight) external override onlyOwner {
        int128 typeId = nGombocTypes;
        gombocTypeNames[typeId] = _name;
        nGombocTypes = typeId + 1;
        if (weight != 0) {
            _changeTypeWeight(typeId, weight);
        }
        emit AddType(_name, typeId);
    }

    /**
     * @notice Change gomboc type `typeId` weight to `weight`
     * @dev only owner call
     * @param typeId Gomboc type id
     * @param weight New Gomboc weight
     */
    function changeTypeWeight(int128 typeId, uint256 weight) external override onlyOwner {
        _changeTypeWeight(typeId, weight);
    }

    /**
     * @notice Change weight of gomboc `addr` to `weight`
     * @param gombocAddress `Gomboc` contract address
     * @param weight New Gomboc weight
     */
    function changeGombocWeight(address gombocAddress, uint256 weight) external override onlyOwner {
        int128 gombocType = _gombocTypes[gombocAddress] - 1;
        require(gombocType >= 0, "GC000");
        _changeGombocWeight(gombocAddress, weight);
    }

    //avoid Stack too deep
    struct VoteForGombocWeightsParam {
        VotedSlope oldSlope;
        VotedSlope newSlope;
        uint256 oldDt;
        uint256 oldBias;
        uint256 newDt;
        uint256 newBias;
        UserPoint newUserPoint;
    }

    /**
     * @notice Allocate voting power for changing pool weights
     * @param gombocAddress Gomboc which `msg.sender` votes for
     * @param userWeight Weight for a gomboc in bps (units of 0.01%). Minimal is 0.01%.
     *        example: 10%=1000,3%=300,0.01%=1,100%=10000
     */
    function voteForGombocWeights(address gombocAddress, uint256 userWeight) external override {
        int128 gombocType = _gombocTypes[gombocAddress] - 1;
        require(gombocType >= 0, "GC000");

        uint256 slope = uint256(IVotingEscrow(votingEscrow).getLastUserSlope(msg.sender));
        uint256 lockEnd = IVotingEscrow(votingEscrow).lockedEnd(msg.sender);
        uint256 nextTime = LibTime.timesRoundedByWeek(block.timestamp + _WEEK);
        require(lockEnd > nextTime, "GC003");
        require(userWeight >= 0 && userWeight <= 10000, "GC004");
        require(block.timestamp >= lastUserVote[msg.sender][gombocAddress] + _WEIGHT_VOTE_DELAY, "GC005");

        VoteForGombocWeightsParam memory param;

        // Prepare slopes and biases in memory
        param.oldSlope = voteUserSlopes[msg.sender][gombocAddress];
        param.oldDt = 0;
        if (param.oldSlope.end > nextTime) {
            param.oldDt = param.oldSlope.end - nextTime;
        }
        param.oldBias = param.oldSlope.slope * param.oldDt;

        param.newSlope = VotedSlope({slope: (slope * userWeight) / 10000, end: lockEnd, power: userWeight});

        // dev: raises when expired
        param.newDt = lockEnd - nextTime;
        param.newBias = param.newSlope.slope * param.newDt;
        param.newUserPoint = UserPoint({bias: param.newBias, slope: param.newSlope.slope, ts: nextTime, blk: block.number});

        // Check and update powers (weights) used
        uint256 powerUsed = voteUserPower[msg.sender];
        powerUsed = powerUsed + param.newSlope.power - param.oldSlope.power;
        voteUserPower[msg.sender] = powerUsed;
        require((powerUsed >= 0) && (powerUsed <= 10000), "GC006");

        //// Remove old and schedule new slope changes
        // Remove slope changes for old slopes
        // Schedule recording of initial slope for nextTime
        uint256 oldWeightBias = _getWeight(gombocAddress);
        uint256 oldWeightSlope = pointsWeight[gombocAddress][nextTime].slope;
        uint256 oldSumBias = _getSum(gombocType);
        uint256 oldSumSlope = pointsSum[gombocType][nextTime].slope;

        pointsWeight[gombocAddress][nextTime].bias = Math.max(oldWeightBias + param.newBias, param.oldBias) - param.oldBias;
        pointsSum[gombocType][nextTime].bias = Math.max(oldSumBias + param.newBias, param.oldBias) - param.oldBias;

        if (param.oldSlope.end > nextTime) {
            pointsWeight[gombocAddress][nextTime].slope =
                Math.max(oldWeightSlope + param.newSlope.slope, param.oldSlope.slope) -
                param.oldSlope.slope;
            pointsSum[gombocType][nextTime].slope =
                Math.max(oldSumSlope + param.newSlope.slope, param.oldSlope.slope) -
                param.oldSlope.slope;
        } else {
            pointsWeight[gombocAddress][nextTime].slope += param.newSlope.slope;
            pointsSum[gombocType][nextTime].slope += param.newSlope.slope;
        }

        if (param.oldSlope.end > block.timestamp) {
            // Cancel old slope changes if they still didn't happen
            _changesWeight[gombocAddress][param.oldSlope.end] -= param.oldSlope.slope;
            changesSum[gombocType][param.oldSlope.end] -= param.oldSlope.slope;
        }

        //Add slope changes for new slopes
        _changesWeight[gombocAddress][param.newSlope.end] += param.newSlope.slope;
        changesSum[gombocType][param.newSlope.end] += param.newSlope.slope;

        _getTotal();

        voteUserSlopes[msg.sender][gombocAddress] = param.newSlope;

        // Record last action time
        lastUserVote[msg.sender][gombocAddress] = block.timestamp;

        //record user point history
        uint256 voteVeLtPointEpoch = lastVoteVeLtPointEpoch[msg.sender][gombocAddress] + 1;
        voteVeLtPointHistory[msg.sender][gombocAddress][voteVeLtPointEpoch] = param.newUserPoint;
        lastVoteVeLtPointEpoch[msg.sender][gombocAddress] = voteVeLtPointEpoch;

        emit VoteForGomboc(msg.sender, gombocAddress, block.timestamp, userWeight);
    }

    /**
     * @notice Get current gomboc weight
     * @param addr Gomboc address
     * @return Gomboc weight
     */
    function getGombocWeight(address addr) external view override returns (uint256) {
        return pointsWeight[addr][timeWeight[addr]].bias;
    }

    /**
     * @notice Get current type weight
     * @param typeId Type id
     * @return Type weight
     */
    function getTypeWeight(int128 typeId) external view override returns (uint256) {
        return pointsTypeWeight[typeId][timeTypeWeight[_int128ToUint256(typeId)]];
    }

    /**
     * @notice Get current total (type-weighted) weight
     * @return Total weight
     */
    function getTotalWeight() external view override returns (uint256) {
        return pointsTotal[timeTotal];
    }

    /**
     * @notice Get sum of gomboc weights per type
     * @param typeId Type id
     * @return Sum of gomboc weights
     */
    function getWeightsSumPreType(int128 typeId) external view override returns (uint256) {
        return pointsSum[typeId][timeSum[_int128ToUint256(typeId)]].bias;
    }

    /**
     * @notice Fill historic type weights week-over-week for missed checkins and return the type weight for the future week
     * @param gombocType Gomboc type id
     * @return Type weight
     */
    function _getTypeWeight(int128 gombocType) internal returns (uint256) {
        uint256 t = timeTypeWeight[_int128ToUint256(gombocType)];
        if (t <= 0) {
            return 0;
        }

        uint256 w = pointsTypeWeight[gombocType][t];
        for (uint256 i = 0; i < 500; i++) {
            if (t > block.timestamp) {
                break;
            }
            t += _WEEK;
            pointsTypeWeight[gombocType][t] = w;
            if (t > block.timestamp) {
                timeTypeWeight[_int128ToUint256(gombocType)] = t;
            }
        }
        return w;
    }

    /**
     * @notice Fill sum of gomboc weights for the same type week-over-week for missed checkins and return the sum for the future week
     * @param gombocType Gomboc type id
     * @return Sum of weights
     */
    function _getSum(int128 gombocType) internal returns (uint256) {
        uint256 ttype = _int128ToUint256(gombocType);
        uint256 t = timeSum[ttype];
        if (t <= 0) {
            return 0;
        }

        Point memory pt = pointsSum[gombocType][t];
        for (uint256 i = 0; i < 500; i++) {
            if (t > block.timestamp) {
                break;
            }
            t += _WEEK;
            uint256 dBias = pt.slope * _WEEK;
            if (pt.bias > dBias) {
                pt.bias -= dBias;
                uint256 dSlope = changesSum[gombocType][t];
                pt.slope -= dSlope;
            } else {
                pt.bias = 0;
                pt.slope = 0;
            }
            pointsSum[gombocType][t] = pt;
            if (t > block.timestamp) {
                timeSum[ttype] = t;
            }
        }
        return pt.bias;
    }

    /**
     * @notice Fill historic total weights week-over-week for missed checkins and return the total for the future week
     * @return Total weight
     */
    function _getTotal() internal returns (uint256) {
        uint256 t = timeTotal;
        int128 _nGombocTypes = nGombocTypes;
        if (t > block.timestamp) {
            // If we have already checkpointed - still need to change the value
            t -= _WEEK;
        }
        uint256 pt = pointsTotal[t];

        for (int128 gombocType = 0; gombocType < 100; gombocType++) {
            if (gombocType == _nGombocTypes) {
                break;
            }
            _getSum(gombocType);
            _getTypeWeight(gombocType);
        }

        for (uint256 i = 0; i < 500; i++) {
            if (t > block.timestamp) {
                break;
            }
            t += _WEEK;
            pt = 0;
            // Scales as n_types * n_unchecked_weeks (hopefully 1 at most)
            for (int128 gombocType = 0; gombocType < 100; gombocType++) {
                if (gombocType == _nGombocTypes) {
                    break;
                }
                uint256 typeSum = pointsSum[gombocType][t].bias;
                uint256 typeWeight = pointsTypeWeight[gombocType][t];
                pt += typeSum * typeWeight;
            }

            pointsTotal[t] = pt;
            if (t > block.timestamp) {
                timeTotal = t;
            }
        }

        return pt;
    }

    /**
     * @notice Fill historic gomboc weights week-over-week for missed checkins and return the total for the future week
     * @param gombocAddr Address of the gomboc
     * @return Gomboc weight
     */
    function _getWeight(address gombocAddr) internal returns (uint256) {
        uint256 t = timeWeight[gombocAddr];

        if (t <= 0) {
            return 0;
        }
        Point memory pt = pointsWeight[gombocAddr][t];
        for (uint256 i = 0; i < 500; i++) {
            if (t > block.timestamp) {
                break;
            }
            t += _WEEK;
            uint256 dBias = pt.slope * _WEEK;
            if (pt.bias > dBias) {
                pt.bias -= dBias;
                uint256 dSlope = _changesWeight[gombocAddr][t];
                pt.slope -= dSlope;
            } else {
                pt.bias = 0;
                pt.slope = 0;
            }
            pointsWeight[gombocAddr][t] = pt;
            if (t > block.timestamp) {
                timeWeight[gombocAddr] = t;
            }
        }
        return pt.bias;
    }

    /**
     * @notice Get Gomboc relative weight (not more than 1.0) normalized to 1e18 (e.g. 1.0 == 1e18).
     * Inflation which will be received by it is inflation_rate * relative_weight / 1e18
     * @param addr Gomboc address
     * @param time Relative weight at the specified timestamp in the past or present
     * @return Value of relative weight normalized to 1e18
     */
    function _gombocRelativeWeight(address addr, uint256 time) internal view returns (uint256) {
        uint256 t = LibTime.timesRoundedByWeek(time);
        uint256 _totalWeight = pointsTotal[t];
        if (_totalWeight <= 0) {
            return 0;
        }

        int128 gombocType = _gombocTypes[addr] - 1;
        uint256 _typeWeight = pointsTypeWeight[gombocType][t];
        uint256 _gombocWeight = pointsWeight[addr][t].bias;
        return (_MULTIPLIER * _typeWeight * _gombocWeight) / _totalWeight;
    }

    function _changeGombocWeight(address addr, uint256 weight) internal {
        // Change gomboc weight
        //Only needed when testing in reality
        int128 gombocType = _gombocTypes[addr] - 1;
        uint256 oldGombocWeight = _getWeight(addr);
        uint256 typeWeight = _getTypeWeight(gombocType);
        uint256 oldSum = _getSum(gombocType);
        uint256 _totalWeight = _getTotal();
        uint256 nextTime = LibTime.timesRoundedByWeek(block.timestamp + _WEEK);

        pointsWeight[addr][nextTime].bias = weight;
        timeWeight[addr] = nextTime;

        uint256 newSum = oldSum + weight - oldGombocWeight;
        pointsSum[gombocType][nextTime].bias = newSum;
        timeSum[_int128ToUint256(gombocType)] = nextTime;

        _totalWeight = _totalWeight + newSum * typeWeight - oldSum * typeWeight;
        pointsTotal[nextTime] = _totalWeight;
        timeTotal = nextTime;

        emit NewGombocWeight(addr, block.timestamp, weight, _totalWeight);
    }

    /**
     *  @notice Change type weight
     * @param typeId Type id
     * @param weight New type weight
     */
    function _changeTypeWeight(int128 typeId, uint256 weight) internal {
        uint256 oldWeight = _getTypeWeight(typeId);
        uint256 oldSum = _getSum(typeId);
        uint256 _totalWeight = _getTotal();
        uint256 nextTime = LibTime.timesRoundedByWeek(block.timestamp + _WEEK);

        _totalWeight = _totalWeight + oldSum * weight - oldSum * oldWeight;
        pointsTotal[nextTime] = _totalWeight;
        pointsTypeWeight[typeId][nextTime] = weight;
        timeTotal = nextTime;
        timeTypeWeight[_int128ToUint256(typeId)] = nextTime;

        emit NewTypeWeight(typeId, nextTime, weight, _totalWeight);
    }

    function _int128ToUint256(int128 from) internal pure returns (uint256) {
        return uint256(uint128(from));
    }
}
