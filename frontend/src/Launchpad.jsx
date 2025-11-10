import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserProvider, Contract, MaxUint256, formatUnits, parseUnits } from 'ethers';
import { useNavigate } from 'react-router-dom';
import {
  STAKE_TOKEN_ADDRESS,
  STAKE_NFT_ADDRESS,
  LAUNCHPAD_CONTRACT_ADDRESS,
  EARN_TOKEN_ADDRESS,
} from './config';
import LaunchpadStakingABI from './abi/LaunchpadStaking.json';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
];

const EARN_TOKEN_ABI = [
  'function MAX_SUPPLY() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

const NFT_WEIGHT = 300;

export default function Launchpad() {
  const navigate = useNavigate();

  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const [stakeTokenInfo, setStakeTokenInfo] = useState({
    name: '',
    symbol: '',
    decimals: 18,
    balance: '0',
  });

  const [nftInfo, setNftInfo] = useState({
    name: '',
    symbol: '',
    balance: 0,
  });

  const [launchpadStats, setLaunchpadStats] = useState({
    stakedTokens: '0',
    stakedNFTs: 0,
    pendingRewards: '0',
    totalEarned: '0',
    totalClaimed: '0',
    stakedNFTIds: [],
    userWeightRaw: '0',
    totalWeightRaw: '0',
    estimatedDailyReward: '0',
    tokenWeightDisplay: '0',
    nftWeightDisplay: '0',
  });

  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [ownedNftIds, setOwnedNftIds] = useState([]);
  const [selectedStakeNftId, setSelectedStakeNftId] = useState('');
  const [selectedUnstakeNftId, setSelectedUnstakeNftId] = useState('');
  const [miningStats, setMiningStats] = useState({
    totalAccrued: '0',
    claimedSupply: '0',
    pendingUnclaimed: '0',
    maxSupply: '0',
    progressPercent: '0',
  });

  const progressPercentNumber = Number(miningStats.progressPercent || '0');
  const progressBarWidth = Math.max(0, Math.min(100, progressPercentNumber));

  const launchpadAddressLabel = useMemo(() => {
    if (
      !LAUNCHPAD_CONTRACT_ADDRESS ||
      LAUNCHPAD_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000'
    ) {
      return '（部署后请在 config.js 填写 Launchpad 合约地址）';
    }
    return LAUNCHPAD_CONTRACT_ADDRESS;
  }, []);

  const disconnectWallet = useCallback(() => {
    setMessage('已断开钱包连接');
    setAccount('');
    setStakeAmount('');
    setUnstakeAmount('');
    setOwnedNftIds([]);
    setSelectedStakeNftId('');
    setSelectedUnstakeNftId('');
    setLaunchpadStats({
      stakedTokens: '0',
      stakedNFTs: 0,
      pendingRewards: '0',
      totalEarned: '0',
      totalClaimed: '0',
      stakedNFTIds: [],
      userWeightRaw: '0',
      totalWeightRaw: '0',
      estimatedDailyReward: '0',
      tokenWeightDisplay: '0',
      nftWeightDisplay: '0',
    });
    setStakeTokenInfo({ name: '', symbol: '', decimals: 18, balance: '0' });
    setNftInfo({ name: '', symbol: '', balance: 0 });
  }, []);

  const loadStakeTokenInfo = useCallback(
    async (address) => {
      if (!provider) return 18;
      const contract = new Contract(STAKE_TOKEN_ADDRESS, ERC20_ABI, provider);
      const [name, symbol, decimals, balance] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.balanceOf(address),
      ]);
      setStakeTokenInfo({
        name,
        symbol,
        decimals: Number(decimals),
        balance: formatUnits(balance, decimals),
      });
      return Number(decimals);
    },
    [provider]
  );

  const loadOwnedNftIds = useCallback(
    async (address) => {
      if (!provider || !address) {
        setOwnedNftIds([]);
        setSelectedStakeNftId('');
        return [];
      }
      try {
        const contract = new Contract(STAKE_NFT_ADDRESS, ERC721_ABI, provider);
        const totalSupply = await contract.totalSupply();
        const ids = [];
        for (let tokenId = 0; tokenId < Number(totalSupply); tokenId++) {
          const owner = await contract.ownerOf(tokenId);
          if (owner && owner.toLowerCase() === address.toLowerCase()) {
            ids.push(tokenId.toString());
          }
        }
        setOwnedNftIds(ids);
        setSelectedStakeNftId((prev) => (prev && ids.includes(prev) ? prev : ids[0] ?? ''));
        return ids;
      } catch (error) {
        console.error('加载 NFT 列表失败:', error);
        setOwnedNftIds([]);
        setSelectedStakeNftId('');
        return [];
      }
    },
    [provider]
  );

  const loadNftInfo = useCallback(
    async (address) => {
      if (!provider) return;
      const contract = new Contract(STAKE_NFT_ADDRESS, ERC721_ABI, provider);
      const [name, symbol, balance] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.balanceOf(address),
      ]);
      setNftInfo({ name, symbol, balance: Number(balance) });
      await loadOwnedNftIds(address);
    },
    [provider, loadOwnedNftIds]
  );

  const loadLaunchpadData = useCallback(
    async (address, decimalsOverride) => {
      if (!provider || !LAUNCHPAD_CONTRACT_ADDRESS) return;
      const contract = new Contract(LAUNCHPAD_CONTRACT_ADDRESS, LaunchpadStakingABI.abi, provider);
      const [
        userInfoRaw,
        pendingRewards,
        totalEarnedValue,
        totalClaimedValue,
        stakedIds,
        totalWeightRawValue,
        dailyRewardValue,
      ] = await Promise.all([
        contract.getUserInfo(address),
        contract.pendingRewards(address),
        contract.totalEarned(address),
        contract.totalClaimed(address),
        contract.stakedNFTs(address),
        contract.totalWeight(),
        contract.DAILY_REWARD(),
      ]);
      const decimals = decimalsOverride ?? 18;
      const userInfo =
        userInfoRaw && typeof userInfoRaw === 'object'
          ? userInfoRaw
          : {
              stakedTokens: userInfoRaw?.[0] ?? 0n,
              stakedNFTs: userInfoRaw?.[1] ?? 0n,
              weight: userInfoRaw?.[2] ?? 0n,
              rewards: userInfoRaw?.[3] ?? 0n,
              rewardPerWeightPaid: userInfoRaw?.[4] ?? 0n,
              claimed: userInfoRaw?.[5] ?? 0n,
            };
      const stakedTokensValue = userInfo.stakedTokens ?? userInfo[0] ?? 0n;
      const stakedNFTsValue = userInfo.stakedNFTs ?? userInfo[1] ?? 0n;
      const userWeightRawValue = BigInt(userInfo.weight ?? userInfo[2] ?? 0n);
      const totalWeightValue = BigInt(totalWeightRawValue ?? 0n);
      const dailyRewardRaw = BigInt(dailyRewardValue ?? 0n);
      const estimatedDailyRaw = totalWeightValue > 0n ? (userWeightRawValue * dailyRewardRaw) / totalWeightValue : 0n;
      const stakedIdStrings = stakedIds.map((id) => id.toString());
      setLaunchpadStats({
        stakedTokens: formatUnits(stakedTokensValue, decimals),
        stakedNFTs: Number(stakedNFTsValue ?? 0n),
        pendingRewards: formatUnits(pendingRewards, 18),
        totalEarned: formatUnits(totalEarnedValue, 18),
        totalClaimed: formatUnits(totalClaimedValue, 18),
        stakedNFTIds: stakedIdStrings,
        userWeightRaw: userWeightRawValue.toString(),
        totalWeightRaw: totalWeightValue.toString(),
        estimatedDailyReward: formatUnits(estimatedDailyRaw, 18),
        tokenWeightDisplay: formatUnits(stakedTokensValue, decimals),
        nftWeightDisplay: (Number(stakedNFTsValue ?? 0n) * NFT_WEIGHT).toString(),
      });
      setSelectedUnstakeNftId((prev) => (prev && stakedIdStrings.includes(prev) ? prev : stakedIdStrings[0] ?? ''));
    },
    [provider]
  );

  const loadMiningStats = useCallback(async () => {
    if (!provider || !LAUNCHPAD_CONTRACT_ADDRESS || !EARN_TOKEN_ADDRESS) return;
    try {
      const launchpad = new Contract(LAUNCHPAD_CONTRACT_ADDRESS, LaunchpadStakingABI.abi, provider);
      const earnToken = new Contract(EARN_TOKEN_ADDRESS, EARN_TOKEN_ABI, provider);
      const [totalAccruedRaw, totalClaimedRaw, totalPendingRaw, maxSupplyRaw] = await Promise.all([
        launchpad.totalRewardsAccrued(),
        launchpad.totalRewardsClaimed(),
        launchpad.totalRewardsPending(),
        earnToken.MAX_SUPPLY(),
      ]);
      const progressPercentRaw = maxSupplyRaw > 0n ? Number((totalAccruedRaw * 10000n) / maxSupplyRaw) / 100 : 0;
      setMiningStats({
        totalAccrued: formatUnits(totalAccruedRaw, 18),
        claimedSupply: formatUnits(totalClaimedRaw, 18),
        pendingUnclaimed: formatUnits(totalPendingRaw, 18),
        maxSupply: formatUnits(maxSupplyRaw, 18),
        progressPercent: progressPercentRaw.toFixed(2),
      });
    } catch (error) {
      console.error('加载挖矿进度失败:', error);
    }
  }, [provider]);

  useEffect(() => {
    if (!window.ethereum) return;
    const browserProvider = new BrowserProvider(window.ethereum);
    setProvider(browserProvider);
    (async () => {
      try {
        const accounts = await browserProvider.send('eth_accounts', []);
        if (accounts && accounts[0]) {
          setAccount(accounts[0]);
        }
      } catch (error) {
        console.error('自动连接钱包失败:', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts && accounts[0]) {
        setAccount(accounts[0]);
      } else {
        disconnectWallet();
      }
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [disconnectWallet]);

  useEffect(() => {
    if (!provider) return;
    loadMiningStats();
  }, [provider, loadMiningStats]);

  useEffect(() => {
    if (!account || !provider) {
      setStakeTokenInfo((prev) => ({ ...prev, balance: '0' }));
      setNftInfo((prev) => ({ ...prev, balance: 0 }));
      setLaunchpadStats((prev) => ({
        ...prev,
        stakedTokens: '0',
        stakedNFTs: 0,
        pendingRewards: '0',
        totalEarned: '0',
        totalClaimed: '0',
        stakedNFTIds: [],
      }));
      setOwnedNftIds([]);
      setSelectedStakeNftId('');
      setSelectedUnstakeNftId('');
      return;
    }
    (async () => {
      try {
        const decimals = await loadStakeTokenInfo(account);
        await Promise.all([
          loadNftInfo(account),
          loadLaunchpadData(account, decimals),
          loadOwnedNftIds(account),
          loadMiningStats(),
        ]);
      } catch (error) {
        console.error('读取资产失败:', error);
        setMessage('读取资产失败，请检查网络或稍后重试。');
      }
    })();
  }, [account, provider, loadStakeTokenInfo, loadNftInfo, loadLaunchpadData, loadOwnedNftIds, loadMiningStats]);

  useEffect(() => {
    if (!account || !provider) return;
    const decimals = stakeTokenInfo.decimals ?? 18;
    const intervalId = setInterval(() => {
      Promise.all([
        loadLaunchpadData(account, decimals),
        loadOwnedNftIds(account),
        loadMiningStats(),
      ]).catch((error) => {
        console.error('定时刷新失败:', error);
      });
    }, 15000);
    return () => clearInterval(intervalId);
  }, [account, provider, stakeTokenInfo.decimals, loadLaunchpadData, loadOwnedNftIds, loadMiningStats]);

  const connectWallet = async () => {
    if (!provider) {
      setMessage('未检测到浏览器钱包，请先安装 MetaMask。');
      return;
    }
    setConnecting(true);
    setMessage('');
    try {
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts && accounts[0]) {
        setAccount(accounts[0]);
      }
    } catch (error) {
      console.error('连接钱包失败:', error);
      setMessage('连接钱包失败，请在钱包中确认授权。');
    } finally {
      setConnecting(false);
    }
  };

  const getSignerAndContracts = async () => {
    if (!provider) throw new Error('尚未检测到钱包 Provider');
    if (!account) throw new Error('请先连接钱包');
    if (!LAUNCHPAD_CONTRACT_ADDRESS) throw new Error('Launchpad 合约地址无效');
    const signer = await provider.getSigner();
    const launchpad = new Contract(LAUNCHPAD_CONTRACT_ADDRESS, LaunchpadStakingABI.abi, signer);
    const stakeToken = new Contract(STAKE_TOKEN_ADDRESS, ERC20_ABI, signer);
    const stakeNft = new Contract(STAKE_NFT_ADDRESS, ERC721_ABI, signer);
    return { signer, launchpad, stakeToken, stakeNft };
  };

  const refreshAll = async () => {
    if (!account) return;
    const decimals = await loadStakeTokenInfo(account);
    await Promise.all([
      loadNftInfo(account),
      loadLaunchpadData(account, decimals),
      loadOwnedNftIds(account),
      loadMiningStats(),
    ]);
  };

  const handleStakeTokens = async () => {
    if (!stakeAmount) {
      setMessage('请输入要质押的代币数量');
      return;
    }
    try {
      setActionLoading('stakeToken');
      setMessage('正在提交代币质押交易...');
      const amountWei = parseUnits(stakeAmount, stakeTokenInfo.decimals || 18);
      const { launchpad, stakeToken } = await getSignerAndContracts();
      const allowance = await stakeToken.allowance(account, LAUNCHPAD_CONTRACT_ADDRESS);
      if (allowance < amountWei) {
        setMessage('检测到代币授权不足，正在发起授权交易...');
        const approveTx = await stakeToken.approve(LAUNCHPAD_CONTRACT_ADDRESS, MaxUint256);
        await approveTx.wait();
        setMessage('✅ 授权成功，请再次点击“确认质押”完成质押。');
        setActionLoading('');
        return;
      }
      setMessage('授权完成，正在发起质押交易...');
      const tx = await launchpad.stakeTokens(amountWei);
      await tx.wait();
      setMessage('✅ 代币质押成功！');
      setStakeAmount('');
      await refreshAll();
    } catch (error) {
      console.error('质押代币失败:', error);
      setMessage(error?.reason || error?.message || '质押代币失败，请稍后重试。');
    } finally {
      setActionLoading('');
    }
  };

  const handleUnstakeTokens = async () => {
    if (!unstakeAmount) {
      setMessage('请输入要解除质押的代币数量');
      return;
    }
    try {
      setActionLoading('unstakeToken');
      setMessage('正在提交解除质押交易...');
      const amountWei = parseUnits(unstakeAmount, stakeTokenInfo.decimals || 18);
      const { launchpad } = await getSignerAndContracts();
      const tx = await launchpad.unstakeTokens(amountWei);
      await tx.wait();
      setMessage('✅ 解除质押成功！');
      setUnstakeAmount('');
      await refreshAll();
    } catch (error) {
      console.error('解除质押失败:', error);
      setMessage(error?.reason || error?.message || '解除质押失败，请稍后重试。');
    } finally {
      setActionLoading('');
    }
  };

  const handleStakeNFT = async () => {
    if (!selectedStakeNftId) {
      setMessage('当前没有可质押的 NFT');
      return;
    }
    try {
      setActionLoading('stakeNFT');
      setMessage('正在准备质押 NFT...');
      const tokenId = BigInt(selectedStakeNftId);
      const { launchpad, stakeNft } = await getSignerAndContracts();
      const approved = await stakeNft.isApprovedForAll(account, LAUNCHPAD_CONTRACT_ADDRESS);
      if (!approved) {
        setMessage('尚未授权 Launchpad 管理 NFT，正在发送授权交易...');
        const approveTx = await stakeNft.setApprovalForAll(LAUNCHPAD_CONTRACT_ADDRESS, true);
        await approveTx.wait();
      }
      setMessage('授权完成，正在发起 NFT 质押交易...');
      const tx = await launchpad.stakeNFT(tokenId);
      await tx.wait();
      setMessage('✅ NFT 质押成功！');
      await refreshAll();
    } catch (error) {
      console.error('质押 NFT 失败:', error);
      setMessage(error?.reason || error?.message || '质押 NFT 失败，请稍后重试。');
    } finally {
      setActionLoading('');
    }
  };

  const handleUnstakeNFT = async () => {
    if (!selectedUnstakeNftId) {
      setMessage('当前没有可解除质押的 NFT');
      return;
    }
    try {
      setActionLoading('unstakeNFT');
      setMessage('正在发起解除 NFT 质押交易...');
      const tokenId = BigInt(selectedUnstakeNftId);
      const { launchpad } = await getSignerAndContracts();
      const tx = await launchpad.unstakeNFT(tokenId);
      await tx.wait();
      setMessage('✅ NFT 已解除质押！');
      await refreshAll();
    } catch (error) {
      console.error('解除 NFT 质押失败:', error);
      setMessage(error?.reason || error?.message || '解除 NFT 质押失败，请稍后重试。');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '60px 24px',
        background:
          'radial-gradient(circle at 10% 20%, rgba(80, 136, 255, 0.22), transparent 60%), radial-gradient(circle at 85% 15%, rgba(168, 82, 255, 0.25), transparent 55%), linear-gradient(135deg, #070b1d 0%, #0d1433 52%, #05060d 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          borderRadius: 28,
          padding: '42px 48px',
          background: 'rgba(16, 23, 46, 0.82)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 32px 110px rgba(12, 15, 45, 0.6)',
          color: '#f1f4ff',
          backdropFilter: 'blur(22px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
          <h1
            style={{
              fontSize: '30px',
              margin: 0,
              background: 'linear-gradient(90deg, #8dd0ff 0%, #d4a4ff 100%)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '0.03em',
            }}
          >
            Launchpad 质押挖矿
          </h1>
          <button
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1px solid rgba(110, 132, 255, 0.35)',
              background: 'rgba(110, 132, 255, 0.15)',
              color: '#e0e6ff',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(110, 132, 255, 0.25)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(110, 132, 255, 0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onClick={() => navigate('/')}
          >
            返回首页
          </button>
        </div>

        <p style={{ color: '#8f9dd6', fontSize: '14px', letterSpacing: '0.02em', marginBottom: '28px' }}>
          Launchpad 允许你质押指定 ERC-20 代币或指定 NFT 来挖掘 EARN 奖励。下面的操作区已经支持一键质押、解除质押以及领取奖励。
        </p>

        {message && (
          <div style={{ marginBottom: '20px', color: '#98a6d9', letterSpacing: '0.02em' }}>{message}</div>
        )}

        <div
          style={{
            marginBottom: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(65, 95, 255, 0.18), rgba(74, 204, 255, 0.16))',
              border: '1px solid rgba(104, 132, 255, 0.35)',
              boxShadow: '0 18px 40px rgba(14, 18, 35, 0.45)',
              minHeight: '74px',
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.75, letterSpacing: '0.08em' }}>钱包状态</div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: account ? '#e8efff' : '#fbb6c2' }}>
              {account ? `已连接：${account}` : '未连接钱包'}
            </div>
          </div>
          <button
            style={{
              padding: '14px 24px',
              borderRadius: '12px',
              background: account ? 'linear-gradient(120deg, #ff6a88, #ff99ac)' : 'linear-gradient(120deg, #6d83ff, #9c6bff)',
              color: '#fff',
              border: 'none',
              cursor: connecting ? 'not-allowed' : 'pointer',
              minWidth: '140px',
              letterSpacing: '0.05em',
              fontWeight: 600,
              transition: 'all 0.3s ease',
            }}
            onClick={account ? disconnectWallet : connectWallet}
            disabled={connecting}
          >
            {connecting ? '连接中...' : account ? '断开钱包' : '连接钱包'}
          </button>
        </div>

        <div
          style={{
            marginBottom: '26px',
            padding: '16px',
            borderRadius: '14px',
            background: 'rgba(22, 29, 62, 0.75)',
            border: '1px solid rgba(140, 152, 255, 0.22)',
          }}
        >
          <div style={{ fontSize: '12px', opacity: 0.75, letterSpacing: '0.08em', marginBottom: '6px' }}>Launchpad 合约地址</div>
          <div style={{ fontSize: '14px', color: '#dbe3ff', wordBreak: 'break-all' }}>{launchpadAddressLabel}</div>
        </div>

        <div
          style={{
            marginBottom: '24px',
            padding: '24px',
            borderRadius: '20px',
            background: 'linear-gradient(140deg, rgba(36, 54, 124, 0.82), rgba(14, 22, 52, 0.78))',
            border: '1px solid rgba(120, 150, 255, 0.35)',
            boxShadow: '0 24px 60px rgba(8, 12, 32, 0.55)',
            color: '#e3ecff',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>挖矿进度</h2>
          <div style={{ marginBottom: '16px', fontSize: '14px', color: '#c7d7ff' }}>
            Launchpad 合约地址：{LAUNCHPAD_CONTRACT_ADDRESS}
          </div>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '14px',
              borderRadius: '999px',
              background: 'rgba(80, 120, 200, 0.2)',
              overflow: 'hidden',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                width: `${progressBarWidth}%`,
                height: '100%',
                background: 'linear-gradient(120deg, #49f2ff, #7d8bff)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ marginBottom: '18px', fontSize: '13px', color: '#b4c6ff' }}>
            当前挖矿进度：{miningStats.progressPercent}% （含未领取部分）
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              fontSize: '14px',
              color: '#d0ddff',
            }}
          >
            <div>累计产生（含未领取）：{miningStats.totalAccrued} EARN</div>
            <div>已领取（已增发）：{miningStats.claimedSupply} EARN</div>
            <div>尚未领取：{miningStats.pendingUnclaimed} EARN</div>
            <div>最大供应量上限：{miningStats.maxSupply} EARN</div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '24px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              padding: '24px',
              borderRadius: '20px',
              background: 'linear-gradient(140deg, rgba(58, 70, 120, 0.75), rgba(45, 58, 122, 0.68))',
              border: '1px solid rgba(136, 158, 255, 0.35)',
              boxShadow: '0 24px 55px rgba(6, 11, 24, 0.58)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#f4f7ff' }}>质押代币</h2>
              <p style={{ margin: '8px 0 0', color: '#9daae0', fontSize: '13px', wordBreak: 'break-all' }}>
                合约地址：{STAKE_TOKEN_ADDRESS}
              </p>
            </div>

            <div style={{ display: 'grid', gap: '12px', fontSize: '14px', color: '#dbe4ff' }}>
              <div>名称 / 符号：{stakeTokenInfo.name} ({stakeTokenInfo.symbol})</div>
              <div>我的余额：{stakeTokenInfo.balance}</div>
              <div>已质押数量：{launchpadStats.stakedTokens}</div>
              <div>代币权重贡献 ≈ {launchpadStats.tokenWeightDisplay}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'rgba(64, 92, 182, 0.32)',
                  border: '1px solid rgba(132, 156, 255, 0.25)',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#dee6ff', fontSize: '16px' }}>质押 {stakeTokenInfo.symbol || '代币'}</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="输入质押数量"
                    style={{
                      flex: '1 1 180px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(134, 150, 255, 0.4)',
                      background: 'rgba(12, 18, 38, 0.45)',
                      color: '#f1f5ff',
                    }}
                  />
                  <button
                    onClick={handleStakeTokens}
                    disabled={actionLoading === 'stakeToken'}
                    style={{
                      padding: '12px 28px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(120deg, #6d83ff, #49c8ff)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {actionLoading === 'stakeToken' ? '执行中...' : '确认质押'}
                  </button>
                </div>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'rgba(140, 78, 204, 0.28)',
                  border: '1px solid rgba(172, 116, 255, 0.3)',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#f7e8ff', fontSize: '16px' }}>解除代币质押</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="输入解除数量"
                    style={{
                      flex: '1 1 180px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(180, 120, 255, 0.4)',
                      background: 'rgba(29, 12, 48, 0.45)',
                      color: '#f7edff',
                    }}
                  />
                  <button
                    onClick={handleUnstakeTokens}
                    disabled={actionLoading === 'unstakeToken'}
                    style={{
                      padding: '12px 28px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(120deg, #a46bff, #ff6fd2)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {actionLoading === 'unstakeToken' ? '执行中...' : '解除质押'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '24px',
              borderRadius: '20px',
              background: 'linear-gradient(140deg, rgba(94, 63, 255, 0.45), rgba(38, 20, 84, 0.82))',
              border: '1px solid rgba(164, 138, 255, 0.32)',
              boxShadow: '0 24px 55px rgba(10, 12, 35, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#f7f0ff' }}>质押 NFT</h2>
              <p style={{ margin: '8px 0 0', color: '#d6c8ff', fontSize: '13px', wordBreak: 'break-all' }}>
                合约地址：{STAKE_NFT_ADDRESS}
              </p>
            </div>

            <div style={{ display: 'grid', gap: '12px', fontSize: '14px', color: '#f3ecff' }}>
              <div>NFT 名称 / 符号：{nftInfo.name} ({nftInfo.symbol})</div>
              <div>我的库存：{nftInfo.balance}</div>
              <div>当前已质押数量：{launchpadStats.stakedNFTs}</div>
              <div>单枚权重：{NFT_WEIGHT}</div>
              <div>NFT 权重贡献 ≈ {launchpadStats.nftWeightDisplay}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'rgba(84, 118, 255, 0.24)',
                  border: '1px solid rgba(110, 162, 255, 0.32)',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#dbe7ff', fontSize: '16px' }}>质押 NFT</h3>
                <div style={{ marginBottom: '12px', color: '#cddcff', fontSize: '13px' }}>选择要质押的 NFT：</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  {ownedNftIds.length === 0 ? (
                    <div style={{ color: '#9eb7ff', fontSize: '13px' }}>暂无可质押的 NFT</div>
                  ) : (
                    ownedNftIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => setSelectedStakeNftId(id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: selectedStakeNftId === id ? '1px solid rgba(142, 178, 255, 0.9)' : '1px solid rgba(142, 178, 255, 0.4)',
                          background: selectedStakeNftId === id ? 'rgba(90, 138, 255, 0.35)' : 'rgba(34, 52, 112, 0.35)',
                          color: '#f1f7ff',
                          cursor: 'pointer',
                        }}
                      >
                        #{id}
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={handleStakeNFT}
                  disabled={actionLoading === 'stakeNFT' || ownedNftIds.length === 0}
                  style={{
                    padding: '12px 28px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(120deg, #5f91ff, #53f3ff)',
                    color: '#fff',
                    cursor: ownedNftIds.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  {actionLoading === 'stakeNFT' ? '执行中...' : '确认质押'}
                </button>
              </div>

              <div
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'rgba(255, 137, 194, 0.22)',
                  border: '1px solid rgba(255, 176, 216, 0.35)',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#ffe9f6', fontSize: '16px' }}>解除 NFT 质押</h3>
                <div style={{ marginBottom: '12px', color: '#ffd3ec', fontSize: '13px' }}>选择要解除的 NFT：</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  {launchpadStats.stakedNFTIds.length === 0 ? (
                    <div style={{ color: '#ffbddc', fontSize: '13px' }}>暂无已质押的 NFT</div>
                  ) : (
                    launchpadStats.stakedNFTIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => setSelectedUnstakeNftId(id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: selectedUnstakeNftId === id ? '1px solid rgba(255, 176, 216, 0.9)' : '1px solid rgba(255, 176, 216, 0.4)',
                          background: selectedUnstakeNftId === id ? 'rgba(255, 137, 194, 0.35)' : 'rgba(112, 38, 72, 0.35)',
                          color: '#ffeef9',
                          cursor: 'pointer',
                        }}
                      >
                        #{id}
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={handleUnstakeNFT}
                  disabled={actionLoading === 'unstakeNFT' || launchpadStats.stakedNFTIds.length === 0}
                  style={{
                    padding: '12px 28px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(120deg, #ff77c7, #ffb36a)',
                    color: '#fff',
                    cursor: launchpadStats.stakedNFTIds.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  {actionLoading === 'unstakeNFT' ? '执行中...' : '解除质押'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginBottom: '24px',
            padding: '28px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, rgba(18, 29, 65, 0.9), rgba(35, 54, 92, 0.72))',
            border: '1px solid rgba(120, 150, 255, 0.28)',
            boxShadow: '0 18px 42px rgba(8, 10, 26, 0.52)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#e5ebff' }}>奖励中心</h2>
            <button
              onClick={async () => {
                try {
                  setActionLoading('claim');
                  setMessage('正在发起领取奖励交易...');
                  const { launchpad } = await getSignerAndContracts();
                  const tx = await launchpad.claim();
                  await tx.wait();
                  setMessage('✅ 奖励领取成功！');
                  await refreshAll();
                } catch (error) {
                  console.error('领取奖励失败:', error);
                  setMessage(error?.reason || error?.message || '领取奖励失败，请稍后重试。');
                } finally {
                  setActionLoading('');
                }
              }}
              disabled={actionLoading === 'claim'}
              style={{
                padding: '12px 28px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(120deg, #2ed68a, #1ab7ff)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}
            >
              {actionLoading === 'claim' ? '领取中...' : '领取奖励'}
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '18px',
              fontSize: '15px',
              color: '#d2ddff',
            }}
          >
            <div>当前可领取：{launchpadStats.pendingRewards} EARN</div>
            <div>累计获得：{launchpadStats.totalEarned} EARN</div>
            <div>历史已领取：{launchpadStats.totalClaimed} EARN</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              fontSize: '14px',
              color: '#c3ceff',
            }}
          >
            <div>当前权重（合约原始值）：{launchpadStats.userWeightRaw}</div>
            <div>全网总权重（原始值）：{launchpadStats.totalWeightRaw}</div>
            <div>代币权重贡献 ≈ {launchpadStats.tokenWeightDisplay}</div>
            <div>NFT 权重贡献 ≈ {launchpadStats.nftWeightDisplay}</div>
            <div>预估每日收益 ≈ {launchpadStats.estimatedDailyReward} EARN</div>
          </div>

          {launchpadStats.stakedNFTIds.length > 0 && (
            <div style={{ color: '#c7d4ff', fontSize: '13px' }}>
              当前质押的 NFT tokenId：{launchpadStats.stakedNFTIds.join(', ')}
            </div>
          )}
        </div>

        <div style={{ color: '#93a6e7', fontSize: '12px' }}>
          温馨提示：质押代币需要先完成授权；初次质押 NFT 需要授权合约管理你持有的 NFT。所有交易都在链上执行，耐心等待确认即可。
        </div>
      </div>
    </div>
  );
}
