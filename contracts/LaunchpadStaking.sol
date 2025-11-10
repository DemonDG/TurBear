// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEarnToken {
    function mint(address to, uint256 amount) external;
}

contract LaunchpadStaking is IERC721Receiver, Ownable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    uint256 public constant NFT_WEIGHT = 300 * 1e18; // 每枚 NFT 对应 300 枚代币的权重（按 1e18 精度）
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant DAILY_REWARD = 10_000 * 1e18; // 每日释放 1 万枚 EARN
    uint256 public constant REWARD_RATE = DAILY_REWARD / SECONDS_PER_DAY; // 按秒释放

    IERC20 public immutable stakeToken; // 代币质押目标（如 CF4...）
    IERC721 public immutable stakeNftToken; // NFT 质押目标
    IEarnToken public immutable rewardToken; // 奖励的 EARN 代币

    uint256 public totalWeight; // 全局权重和
    uint256 public lastUpdateTime; // 最近一次更新时间
    uint256 public rewardPerWeightStored; // 全局累计奖励（按权重）
    uint256 public totalAccruedRewards; // 全局已累计产生的奖励（包含未领取）
    uint256 public totalClaimedRewards; // 全局已领取的奖励

    struct UserInfo {
        uint256 stakedTokens; // 质押的 ERC20 数量
        uint256 stakedNFTs; // 质押的 NFT 数量
        uint256 weight; // 总权重
        uint256 rewards; // 尚未领取的奖励
        uint256 rewardPerWeightPaid; // 用户已记录的 rewardPerWeight
        uint256 claimed; // 历史已领取的奖励总量
    }

    mapping(address => UserInfo) public userInfo;
    mapping(address => EnumerableSet.UintSet) private userNFTs; // 记录每个用户质押的 tokenId

    event StakeToken(address indexed user, uint256 amount);
    event UnstakeToken(address indexed user, uint256 amount);
    event StakeNFT(address indexed user, uint256 tokenId);
    event UnstakeNFT(address indexed user, uint256 tokenId);
    event RewardPaid(address indexed user, uint256 reward);

    constructor(
        address owner_,
        IERC20 _stakeToken,
        IERC721 _stakeNFT,
        IEarnToken _rewardToken
    ) Ownable(owner_) {
        require(address(_stakeToken) != address(0) && address(_stakeNFT) != address(0) && address(_rewardToken) != address(0), "invalid address");
        stakeToken = _stakeToken;
        stakeNftToken = _stakeNFT;
        rewardToken = _rewardToken;
        lastUpdateTime = block.timestamp;
    }

    modifier updateReward(address account) {
        uint256 pendingGlobal = _pendingGlobalReward();
        if (pendingGlobal > 0) {
            totalAccruedRewards += pendingGlobal;
        }
        rewardPerWeightStored = rewardPerWeight();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            UserInfo storage user = userInfo[account];
            user.rewards = earned(account);
            user.rewardPerWeightPaid = rewardPerWeightStored;
        }
        _;
    }

    function rewardPerWeight() public view returns (uint256) {
        if (totalWeight == 0) {
            return rewardPerWeightStored;
        }
        uint256 timeDelta = block.timestamp - lastUpdateTime;
        uint256 additional = (timeDelta * REWARD_RATE * 1e18) / totalWeight;
        return rewardPerWeightStored + additional;
    }

    function _pendingGlobalReward() internal view returns (uint256) {
        if (totalWeight == 0) {
            return 0;
        }
        uint256 timeDelta = block.timestamp - lastUpdateTime;
        return timeDelta * REWARD_RATE;
    }

    function earned(address account) public view returns (uint256) {
        UserInfo storage user = userInfo[account];
        uint256 accumulated = (user.weight * (rewardPerWeight() - user.rewardPerWeightPaid)) / 1e18;
        return accumulated + user.rewards;
    }

    function stakeTokens(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "amount = 0");
        UserInfo storage user = userInfo[msg.sender];

        stakeToken.safeTransferFrom(msg.sender, address(this), amount);
        user.stakedTokens += amount;
        _increaseWeight(msg.sender, amount);

        emit StakeToken(msg.sender, amount);
    }

    function unstakeTokens(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "amount = 0");
        UserInfo storage user = userInfo[msg.sender];
        require(user.stakedTokens >= amount, "insufficient stake");

        user.stakedTokens -= amount;
        _decreaseWeight(msg.sender, amount);

        stakeToken.safeTransfer(msg.sender, amount);
        emit UnstakeToken(msg.sender, amount);
    }

    function stakeNFT(uint256 tokenId) public updateReward(msg.sender) {
        stakeNftToken.safeTransferFrom(msg.sender, address(this), tokenId);
        require(userNFTs[msg.sender].add(tokenId), "stake failed");

        UserInfo storage user = userInfo[msg.sender];
        user.stakedNFTs += 1;
        _increaseWeight(msg.sender, NFT_WEIGHT);

        emit StakeNFT(msg.sender, tokenId);
    }

    function unstakeNFT(uint256 tokenId) public updateReward(msg.sender) {
        require(userNFTs[msg.sender].contains(tokenId), "not staked");
        require(userNFTs[msg.sender].remove(tokenId), "remove failed");

        UserInfo storage user = userInfo[msg.sender];
        user.stakedNFTs -= 1;
        _decreaseWeight(msg.sender, NFT_WEIGHT);

        stakeNftToken.safeTransferFrom(address(this), msg.sender, tokenId);
        emit UnstakeNFT(msg.sender, tokenId);
    }

    function claim() public updateReward(msg.sender) {
        UserInfo storage user = userInfo[msg.sender];
        uint256 reward = user.rewards;
        require(reward > 0, "no rewards");
        user.rewards = 0;
        user.claimed += reward;
        totalClaimedRewards += reward;
        rewardToken.mint(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    function exit() external {
        claim();
        uint256 tokenAmount = userInfo[msg.sender].stakedTokens;
        if (tokenAmount > 0) {
            unstakeTokens(tokenAmount);
        }

        EnumerableSet.UintSet storage set = userNFTs[msg.sender];
        while (set.length() > 0) {
            uint256 tokenId = set.at(set.length() - 1);
            unstakeNFT(tokenId);
        }
    }

    function _increaseWeight(address account, uint256 added) internal {
        totalWeight += added;
        userInfo[account].weight += added;
    }

    function _decreaseWeight(address account, uint256 removed) internal {
        totalWeight -= removed;
        userInfo[account].weight -= removed;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // 辅助查询：获取地址质押的 NFT tokenIds
    function stakedNFTs(address account) external view returns (uint256[] memory) {
        EnumerableSet.UintSet storage set = userNFTs[account];
        uint256 length = set.length();
        uint256[] memory tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            tokenIds[i] = set.at(i);
        }
        return tokenIds;
    }

    function pendingRewards(address account) external view returns (uint256) {
        return earned(account);
    }

    function totalEarned(address account) external view returns (uint256) {
        UserInfo storage user = userInfo[account];
        return user.claimed + earned(account);
    }

    function totalClaimed(address account) external view returns (uint256) {
        return userInfo[account].claimed;
    }

    function getUserInfo(address account) external view returns (UserInfo memory) {
        return userInfo[account];
    }

    function totalRewardsAccrued() public view returns (uint256) {
        return totalAccruedRewards + _pendingGlobalReward();
    }

    function totalRewardsClaimed() external view returns (uint256) {
        return totalClaimedRewards;
    }

    function totalRewardsPending() external view returns (uint256) {
        uint256 accrued = totalRewardsAccrued();
        if (accrued > totalClaimedRewards) {
            return accrued - totalClaimedRewards;
        }
        return 0;
    }
}
