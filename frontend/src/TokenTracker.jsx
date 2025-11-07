import React, { useEffect, useMemo, useState } from 'react'; // 引入 React 相关 Hook
import { BrowserProvider, isAddress, formatEther, formatUnits } from 'ethers'; // 从 ethers 引入常用工具函数
import { useNavigate } from 'react-router-dom'; // 引入导航 Hook
import {
  ALCHEMY_API_KEY,
  ALCHEMY_RPC_URL,
  ALCHEMY_NFT_API_URL,
} from './config'; // 引入配置里的 Alchemy 信息

export default function TokenTracker() { // 定义追踪资产页面组件
  const navigate = useNavigate(); // 方便返回首页
  const [provider, setProvider] = useState(null); // 保存浏览器 Provider
  const [account, setAccount] = useState(''); // 当前连接的钱包
  const [holderAddress, setHolderAddress] = useState(''); // 想要查询的地址
  const [connecting, setConnecting] = useState(false); // 控制“连接钱包”按钮状态
  const [loading, setLoading] = useState(false); // 控制查询过程的加载状态
  const [message, setMessage] = useState(''); // 提示信息
  const [ethBalance, setEthBalance] = useState(null); // 查询地址的 ETH 余额
  const [tokenHoldings, setTokenHoldings] = useState([]); // 储存 ERC-20 资产信息
  const [nftHoldings, setNftHoldings] = useState([]); // 储存 NFT 资产信息

  const hasValidAlchemyKey = useMemo(() => { // 检查 Alchemy Key 是否已填写
    return ALCHEMY_API_KEY && !ALCHEMY_API_KEY.includes('YOUR_ALCHEMY_API_KEY');
  }, []);

  useEffect(() => { // 组件挂载时尝试自动连接钱包
    if (window.ethereum) { // 浏览器存在钱包
      const browserProvider = new BrowserProvider(window.ethereum); // 构造 Provider
      setProvider(browserProvider); // 保存 Provider

      (async () => { // 自动查询已授权账户
        try {
          const accounts = await browserProvider.send('eth_accounts', []);
          if (accounts && accounts[0]) {
            setAccount(accounts[0]); // 存储默认账户
          }
        } catch (error) {
          console.error('自动连接钱包失败:', error); // 失败时仅提示
        }
      })();
    }
  }, []); // 仅初始化时执行

  const connectWallet = async () => { // 手动连接钱包
    if (!provider) {
      setMessage('未检测到浏览器钱包，请先安装 MetaMask。');
      return;
    }

    setConnecting(true);
    setMessage('');

    try {
      const accounts = await provider.send('eth_requestAccounts', []); // 请求授权
      if (accounts && accounts[0]) {
        setAccount(accounts[0]);
        setHolderAddress(accounts[0]); // 默认查询当前钱包
      }
    } catch (error) {
      console.error('连接钱包失败:', error);
      setMessage('连接钱包失败，请在钱包中确认授权请求。');
    } finally {
      setConnecting(false);
    }
  };

  const fetchEthBalance = async (addressToQuery) => { // 读取 ETH 余额
    try {
      const readProvider = provider ?? new BrowserProvider(window.ethereum); // 若尚未保存 provider，则新建一个
      const balance = await readProvider.getBalance(addressToQuery); // 读取余额
      setEthBalance(formatEther(balance)); // 转成 ETH 小数形式
    } catch (error) {
      console.error('读取 ETH 余额失败:', error);
      setEthBalance(null);
    }
  };

  const rpcRequest = async (method, params) => { // 统一封装 JSON-RPC 请求
    const response = await fetch(ALCHEMY_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Alchemy RPC 错误');
    }
    return data.result;
  };

  const fetchTokenHoldings = async (addressToQuery) => { // 查询 ERC-20 资产列表
    if (!hasValidAlchemyKey) { // 没有 API Key 则直接提示
      setMessage('请先在 config.js 填写有效的 Alchemy API Key。');
      setTokenHoldings([]);
      return;
    }

    const tokenBalances = await rpcRequest('alchemy_getTokenBalances', [addressToQuery]); // 调用 Alchemy 接口
    const nonZeroBalances = (tokenBalances?.tokenBalances || []).filter((item) => item.tokenBalance !== '0x0'); // 过滤为 0 的资产

    const limited = nonZeroBalances.slice(0, 20); // Demo：最多取前 20 个资产

    const detailed = await Promise.all(
      limited.map(async (token) => { // 循环获取 metadata
        const metadata = await rpcRequest('alchemy_getTokenMetadata', [token.contractAddress]);
        const decimals = metadata?.decimals ?? 0;
        let formatted = token.tokenBalance;
        try {
          formatted = formatUnits(BigInt(token.tokenBalance), decimals);
        } catch (error) {
          formatted = token.tokenBalance;
        }
        return {
          address: token.contractAddress,
          balanceRaw: token.tokenBalance,
          formattedBalance: formatted,
          name: metadata?.name ?? 'Unknown Token',
          symbol: metadata?.symbol ?? '???',
          decimals,
        };
      })
    );

    setTokenHoldings(detailed);
  };

  const fetchNftHoldings = async (addressToQuery) => { // 查询 NFT 资产
    if (!hasValidAlchemyKey) {
      setNftHoldings([]);
      return;
    }

    const response = await fetch(`${ALCHEMY_NFT_API_URL}/getNFTs?owner=${addressToQuery}`); // 调用 REST NFT 接口
    const data = await response.json();
    if (data.ownedNfts) {
      setNftHoldings(data.ownedNfts.slice(0, 30)); // Demo：最多展示 30 个
    } else {
      setNftHoldings([]);
    }
  };

  const handleTrack = async () => { // 主查询逻辑
    if (!holderAddress) {
      setMessage('请输入要查询的地址。');
      return;
    }

    if (!isAddress(holderAddress)) {
      setMessage('请输入合法的以太坊地址。');
      return;
    }

    if (!hasValidAlchemyKey) {
      setMessage('未检测到有效的 Alchemy API Key，请先在 config.js 中配置。');
      return;
    }

    setLoading(true);
    setMessage('正在查询链上资产，请稍候...');
    setTokenHoldings([]);
    setNftHoldings([]);
    setEthBalance(null);

    try {
      await Promise.all([
        fetchEthBalance(holderAddress),
        fetchTokenHoldings(holderAddress),
        fetchNftHoldings(holderAddress),
      ]);
      setMessage('✅ 查询完成，如下为当前地址的资产快照');
    } catch (error) {
      console.error('查询资产失败:', error);
      setMessage('查询失败，请检查网络或稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '60px 24px',
        background: 'radial-gradient(circle at 10% 20%, rgba(80, 136, 255, 0.22), transparent 60%), radial-gradient(circle at 85% 15%, rgba(168, 82, 255, 0.25), transparent 55%), linear-gradient(135deg, #070b1d 0%, #0d1433 52%, #05060d 100%)',
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
          backdropFilter: 'blur(22px)'
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
            地址资产追踪（ERC-20 & NFT）
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
          输入任意地址后，我们会使用 Alchemy API 帮你展示该地址的 ETH 余额、ERC-20 代币以及 NFT 持仓。初次使用请先在 config.js 配置 Alchemy API Key。
        </p>

        {/* 钱包连接状态与按钮 */}
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
              background: 'linear-gradient(120deg, #6d83ff, #9c6bff)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              minWidth: '140px',
              letterSpacing: '0.05em',
              fontWeight: 600,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 20px 45px rgba(108, 131, 255, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={connectWallet}
            disabled={connecting}
          >
            {connecting ? '连接中...' : '连接钱包'}
          </button>
        </div>

        {!hasValidAlchemyKey && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'rgba(255, 92, 92, 0.12)',
              border: '1px solid rgba(255, 119, 119, 0.3)',
              color: '#ffdfe0',
              marginBottom: '20px',
              fontSize: '13px',
            }}
          >
            ⚠️ 检测到配置文件中的 Alchemy API Key 仍是默认值，请先在 <code>frontend/src/config.js</code> 中替换为真实的 Key，否则无法获取资产信息。
          </div>
        )}

        {/* 地址输入 + 查询按钮 */}
        <div
          style={{
            marginBottom: '30px',
            background: 'rgba(18, 26, 52, 0.75)',
            borderRadius: '16px',
            padding: '24px 20px',
            border: '1px solid rgba(115, 136, 255, 0.22)',
            boxShadow: '0 22px 45px rgba(7, 12, 26, 0.45)',
          }}
        >
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', letterSpacing: '0.06em', opacity: 0.8 }}>
            需要查询的地址
          </label>
          <input
            placeholder="请输入任意以太坊地址"
            value={holderAddress}
            onChange={(event) => setHolderAddress(event.target.value.trim())}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(122, 148, 255, 0.35)',
              background: 'rgba(30, 40, 78, 0.6)',
              color: '#f4f6ff',
              fontSize: '15px',
              outline: 'none',
              transition: 'border-color 0.25s ease'
            }}
            onFocus={(event) => {
              event.target.style.borderColor = 'rgba(164, 188, 255, 0.75)';
              event.target.style.boxShadow = '0 0 0 3px rgba(164, 188, 255, 0.18)';
            }}
            onBlur={(event) => {
              event.target.style.borderColor = 'rgba(122, 148, 255, 0.35)';
              event.target.style.boxShadow = 'none';
            }}
          />
          <button
            style={{
              marginTop: '18px',
              padding: '14px',
              width: '100%',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(120deg, #67f0ff, #7b73ff)',
              color: '#060c1f',
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 20px 45px rgba(103, 171, 255, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={handleTrack}
            disabled={loading}
          >
            {loading ? '资产查询中...' : '查询地址资产'}
          </button>
        </div>

        {message && (
          <div style={{ marginBottom: '22px', color: '#98a6d9', letterSpacing: '0.02em' }}>{message}</div>
        )}

        {/* ETH 余额显示 */}
        {ethBalance !== null && (
          <div
            style={{
              marginBottom: '24px',
              padding: '16px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(90, 200, 250, 0.18), rgba(47, 123, 255, 0.16))',
              border: '1px solid rgba(110, 190, 255, 0.3)',
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.75, letterSpacing: '0.08em', marginBottom: '6px' }}>ETH 余额</div>
            <div style={{ fontSize: '20px', fontWeight: 600 }}>{ethBalance} ETH</div>
          </div>
        )}

        {/* ERC-20 资产列表 */}
        {tokenHoldings.length > 0 && (
          <div
            style={{
              marginBottom: '26px',
              padding: '22px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(58, 70, 120, 0.68), rgba(34, 41, 82, 0.75))',
              border: '1px solid rgba(164, 178, 255, 0.28)',
              boxShadow: '0 24px 48px rgba(6, 9, 21, 0.58)',
            }}
          >
            <h2 style={{ margin: 0, marginBottom: '16px', fontSize: '20px', color: '#e8edff' }}>ERC-20 代币</h2>
            <p style={{ marginTop: 0, marginBottom: '18px', color: '#9daae0', fontSize: '13px' }}>
              仅展示前 20 个非零资产，数值已经根据 decimals 进行了格式化。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {tokenHoldings.map((token) => (
                <div
                  key={token.address}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(15, 20, 44, 0.85)',
                    border: '1px solid rgba(135, 158, 255, 0.25)',
                    boxShadow: '0 16px 32px rgba(7, 9, 24, 0.45)'
                  }}
                >
                  <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>名称 / 符号</div>
                  <div style={{ fontSize: '16px', color: '#f6f8ff', marginBottom: '8px' }}>
                    {token.name} ({token.symbol})
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>持有数量</div>
                  <div style={{ fontSize: '15px', color: '#dce5ff', marginBottom: '8px' }}>{token.formattedBalance}</div>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '6px' }}>合约地址</div>
                  <div style={{ fontSize: '12px', color: '#9fb0ff', wordBreak: 'break-all' }}>{token.address}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NFT 列表 */}
        {nftHoldings.length > 0 && (
          <div
            style={{
              marginBottom: '26px',
              padding: '22px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(94, 63, 255, 0.42), rgba(40, 21, 76, 0.85))',
              border: '1px solid rgba(164, 138, 255, 0.28)',
              boxShadow: '0 24px 48px rgba(6, 9, 21, 0.58)',
            }}
          >
            <h2 style={{ margin: 0, marginBottom: '16px', fontSize: '20px', color: '#f4edff' }}>NFT 资产</h2>
            <p style={{ marginTop: 0, marginBottom: '18px', color: '#cdc4ff', fontSize: '13px' }}>
              仅展示前 30 个 NFT，元数据和预览由 Alchemy 提供。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '18px' }}>
              {nftHoldings.map((nft) => (
                <div
                  key={`${nft.contract?.address}-${nft.tokenId}`}
                  style={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: 'rgba(12, 14, 28, 0.85)',
                    border: '1px solid rgba(144, 114, 255, 0.25)',
                    boxShadow: '0 18px 36px rgba(7, 9, 24, 0.48)',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '160px',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(54, 32, 99, 0.5)',
                    }}
                  >
                    {nft.media && nft.media[0]?.gateway ? (
                      <img
                        src={nft.media[0].gateway}
                        alt={nft.title || nft.tokenId}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = '<div style="color: #d7c9ff; font-size: 13px;">暂无预览</div>';
                        }}
                      />
                    ) : (
                      <div style={{ color: '#d7c9ff', fontSize: '13px' }}>暂无预览</div>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: '13px', color: '#f5f1ff', marginBottom: '6px' }}>{nft.contractMetadata?.name || '未命名 NFT'}</div>
                    <div style={{ fontSize: '12px', color: '#bdb3ff', marginBottom: '6px' }}>Token ID: {nft.tokenId}</div>
                    <div style={{ fontSize: '11px', color: '#a9a4ff', wordBreak: 'break-all', marginBottom: '6px' }}>合约: {nft.contract?.address}</div>
                    {nft.tokenUri?.gateway && (
                      <a
                        href={nft.tokenUri.gateway}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: '#9af0ff', textDecoration: 'none' }}
                      >
                        查看元数据
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 没有资产时给出提示 */}
        {!loading && tokenHoldings.length === 0 && nftHoldings.length === 0 && ethBalance === '0.0' && message.includes('查询完成') && (
          <div style={{ color: '#a6b1d9', textAlign: 'center' }}>该地址暂无可展示的 ERC-20 或 NFT 持仓。</div>
        )}
      </div>
    </div>
  );
}
