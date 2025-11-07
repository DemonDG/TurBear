import React, { useState, useEffect } from 'react'; // 引入 React 以及 useState、useEffect Hook，用于管理组件状态和副作用
import { BrowserProvider, Contract } from 'ethers'; // 从 ethers 引入 BrowserProvider 与 Contract，便于与钱包和智能合约交互
import { useNavigate } from 'react-router-dom'; // 引入 useNavigate，用于在前端路由之间跳转
import { NFT_CONTRACT_ADDRESS } from './config'; // 引入配置文件里记录的 NFT 合约地址
import RarityNFTABI from './abi/RarityNFT.json'; // 引入已编译好的 NFT 合约 ABI

export default function NFTMintPage() { // 定义并导出 NFT 铸造页面组件
  const navigate = useNavigate(); // 获取路由跳转函数，用于返回首页等
  const [provider, setProvider] = useState(null); // 保存浏览器中的以太坊 provider 实例
  const [signer, setSigner] = useState(null); // 保存当前连接钱包的签名器（带私钥权限）
  const [account, setAccount] = useState(''); // 保存当前连接的钱包地址
  const [loading, setLoading] = useState(false); // 控制铸造按钮的加载状态，避免重复提交
  const [message, setMessage] = useState(''); // 展示给用户的提示信息（成功/失败等）
  const [mintAmount, setMintAmount] = useState('1'); // 记录用户希望一次铸造的 NFT 数量，默认 1
  const [nftBalance, setNftBalance] = useState(0); // 当前账户拥有的 NFT 数量
  const [totalSupply, setTotalSupply] = useState(0); // NFT 合约当前的总供应量
  const [imageError, setImageError] = useState(false); // 控制预览图加载失败时的兜底逻辑
  const [userNFTs, setUserNFTs] = useState([]); // 保存当前地址拥有的所有 NFT 详细信息
  const [loadingNFTs, setLoadingNFTs] = useState(false); // 控制 NFT 列表加载状态，便于显示“加载中”提示

  const formatTokenUri = (uri) => { // 定义一个辅助函数，用于处理 tokenURI 地址
    if (!uri) return ''; // 若未传入 URI，直接返回空字符串
    return uri.startsWith('http://localhost:5173') // 判断 URI 是否为本地开发环境
      ? uri.replace('http://localhost:5173', '') // 本地环境下转换成相对路径，便于 static 资源访问
      : uri; // 对于其他域名的 URI，保持原样返回
  };

  const loadNFTData = async (signerInstance) => { // 定义一个异步函数，用于读取链上 NFT 数据
    if (!signerInstance) return; // 若没有签名器（未连接钱包）则无需继续

    try {
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, RarityNFTABI, signerInstance); // 根据地址和 ABI 构造合约实例
      const userAddress = await signerInstance.getAddress(); // 获取当前钱包地址，供后续查询使用
      const balance = await nftContract.balanceOf(userAddress); // 读取当前地址拥有的 NFT 数量
      const supply = await nftContract.totalSupply(); // 读取合约的总供应量
      setNftBalance(Number(balance)); // 写入 NFT 数量状态
      setTotalSupply(Number(supply)); // 写入总供应量状态
      await loadUserNFTs(nftContract, userAddress, Number(supply)); // 继续加载当前地址所拥有的 NFT 详细信息
    } catch (error) {
      console.error('加载NFT数据失败:', error); // 请求失败时输出错误日志，方便排查
    }
  };

  const loadUserNFTs = async (nftContract, userAddress, currentSupply) => { // 定义一个异步函数，遍历链上 tokenId 并筛选当前地址拥有的 NFT
    if (!nftContract || !userAddress) { // 若缺少合约实例或地址，则无需执行
      setUserNFTs([]); // 清空列表以防UI显示旧数据
      return; // 直接退出
    }

    if (currentSupply === 0) { // 若合约总供应量为 0
      setUserNFTs([]); // 清空用户 NFT 列表
      return; // 也无须继续遍历
    }

    setLoadingNFTs(true); // 设置加载状态，UI 可显示“加载中”提示
    const ownedNFTs = []; // 临时数组，用于存储遍历过程中找到的 NFT 信息

    try {
      for (let tokenId = 0; tokenId < currentSupply; tokenId += 1) { // 遍历 tokenId，从 0 开始到 currentSupply-1
        try {
          const owner = await nftContract.ownerOf(tokenId); // 查询当前 tokenId 的拥有者
          if (owner.toLowerCase() === userAddress.toLowerCase()) { // 若拥有者与当前地址相同
            const tokenURI = await nftContract.tokenURI(tokenId); // 读取该 token 的元数据 URI
            ownedNFTs.push({ tokenId, tokenURI, owner }); // 将 token 信息保存到临时数组
          }
        } catch (innerError) {
          // ownerOf 可能因 token 未铸造或被销毁而抛错，此处静默跳过即可
        }
      }

      setUserNFTs(ownedNFTs); // 遍历结束后，将结果写入状态
    } catch (error) {
      console.error('加载用户NFT列表失败:', error); // 若遍历过程出现异常，记录日志
      setUserNFTs([]); // 清空列表以保证 UI 一致
    } finally {
      setLoadingNFTs(false); // 无论成功或失败，都要关闭加载状态
    }
  };

  const handleMintAmountChange = (event) => { // 定义一个函数，用于限制铸造数量的输入范围
    const { value } = event.target; // 取出输入框的值
    if (value === '') { // 如果输入为空，允许用户暂时清空
      setMintAmount('');
      return;
    }

    const numericValue = parseInt(value, 10); // 将输入转为整数
    if (Number.isNaN(numericValue)) { // 如果无法转换为数字，则不更新状态
      return;
    }

    const clampedValue = Math.max(1, Math.min(5, numericValue)); // 将输入限制在 1 到 5 之间
    setMintAmount(String(clampedValue)); // 将合法数值存入状态，并转成字符串
  };

  useEffect(() => { // 页面首次渲染时自动执行，尝试连接钱包
    if (window.ethereum) { // 判断浏览器里是否注入了钱包（如 MetaMask）
      const p = new BrowserProvider(window.ethereum); // 创建浏览器 provider
      setProvider(p); // 保存 provider，后续连接钱包或发交易时使用

      (async () => { // 立即执行函数，尝试自动获取已授权的账户
        try {
          const accs = await p.send('eth_accounts', []); // 读取已授权账号列表
          if (accs && accs[0]) { // 如果存在账号
            const s = await p.getSigner(); // 获取签名器
            setSigner(s); // 保存签名器
            setAccount(accs[0]); // 保存账号地址
          }
        } catch (error) {
          console.error('自动连接失败:', error); // 自动连接失败时记录日志
        }
      })();

      window.ethereum.on?.('accountsChanged', async (accs) => { // 监听钱包账户切换事件
        if (accs && accs[0]) { // 当切换到新的账号时
          const s = await p.getSigner(); // 重新获取签名器
          setSigner(s); // 更新签名器状态
          setAccount(accs[0]); // 更新账号地址
          await loadNFTData(s); // 重新拉取该账号的 NFT 数据
        } else { // 如果钱包断开连接
          setSigner(null); // 清空签名器
          setAccount(''); // 清空地址
          setNftBalance(0); // 重置 NFT 数量显示
          setUserNFTs([]); // 清空 NFT 列表，避免显示上一账号数据
        }
      });
    }
  }, []); // 依赖数组为空，只在组件挂载时执行一次

  useEffect(() => { // 当签名器或账号变化时重新加载链上数据
    if (signer && account) { // 仅在有签名器且连接了账号时执行
      loadNFTData(signer); // 调用加载函数，读取新的地址数据
    }
  }, [signer, account]); // 依赖为 signer 和 account

  const connectWallet = async () => { // 定义一个函数，让用户手动连接钱包
    if (!provider) return; // 没有 provider 时直接返回
    try {
      const accs = await provider.send('eth_requestAccounts', []); // 主动请求钱包授权并返回账号
      const s = await provider.getSigner(); // 获取签名器
      setSigner(s); // 保存签名器
      setAccount(accs[0]); // 保存当前账号
    } catch (error) {
      setMessage('连接钱包失败'); // 设置错误提示文案
      console.error('连接钱包错误:', error); // 输出错误日志
    }
  };

  const handleMint = async () => { // 定义铸造 NFT 的逻辑
    if (!signer) { // 若未连接钱包
      setMessage('请先连接钱包'); // 提示用户需要连接钱包
      return; // 直接返回
    }

    const amount = parseInt(mintAmount, 10); // 将输入的铸造数量转成数字
    if (Number.isNaN(amount) || amount < 1 || amount > 5) { // 再次校验数量，确保在 1-5 之间
      setMessage('铸造数量需在 1 到 5 之间'); // 提示用户输入有误
      return; // 直接返回
    }

    setLoading(true); // 设置按钮为加载状态
    setMessage(''); // 清空之前的提示信息

    try {
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, RarityNFTABI, signer); // 构造合约实例
      const userAddress = await signer.getAddress(); // 获取当前账户地址

      setMessage('正在发送铸造交易...'); // 提示用户正在发送交易
      const tx = amount === 1 // 根据数量决定调用单个或批量铸造
        ? await nftContract.mint(userAddress)
        : await nftContract.mintBatch(userAddress, amount);

      setMessage('交易已发送，等待区块确认...'); // 提示交易已提交
      console.log('交易哈希:', tx.hash); // 控制台记录交易哈希

      const receipt = await tx.wait(); // 等待交易被链上确认

      if (receipt.status === 1) { // 交易成功
        setMessage(`✅ 成功铸造 ${amount} 个 NFT！交易哈希: ${tx.hash}`); // 显示成功消息
        await loadNFTData(signer); // 重新拉取最新的 NFT 数量
        setMintAmount('1'); // 复位输入框，方便下一次操作
      } else { // 交易失败
        setMessage('❌ 交易失败'); // 显示失败提示
      }
    } catch (error) {
      console.error('铸造错误:', error); // 输出错误日志
      if (error.reason) { // 如果错误对象中有明确的 reason
        setMessage(`❌ 铸造失败: ${error.reason}`); // 将 reason 展示给用户
      } else if (error.message) { // 或者有 message 字段
        setMessage(`❌ 铸造失败: ${error.message}`); // 展示具体错误信息
      } else { // 其他情况
        setMessage('❌ NFT铸造失败，请检查网络连接和账户余额'); // 展示通用错误提示
      }
    } finally {
      setLoading(false); // 不论成功失败都取消加载状态
    }
  };

  return ( // 渲染页面结构
    <div
      style={{
        minHeight: '100vh', // 设置最小高度为整屏，以便背景铺满
        padding: '60px 24px', // 为页面内容留出更宽松的上下留白
        background: 'radial-gradient(circle at 20% 20%, rgba(72, 149, 239, 0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(142, 84, 233, 0.30), transparent 46%), linear-gradient(135deg, #090d1a 5%, #101736 48%, #04070f 95%)', // 叠加多个渐变，打造高端背景层次
        display: 'flex', // 让容器使用 flex 布局
        justifyContent: 'center', // 让内部卡片水平居中
        alignItems: 'flex-start', // 顶部对齐，让滚动时更自然
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          borderRadius: 28,
          padding: '40px 48px',
          background: 'rgba(12, 18, 46, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 40px 120px rgba(17, 12, 46, 0.55)',
          backdropFilter: 'blur(24px)',
          color: '#F6F8FF',
        }}
      >
        {/* 页面顶部：标题和返回按钮 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '32px',
          }}
        >
          {/* 标题显示当前页面功能 */}
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              background: 'linear-gradient(90deg, #8ec5ff, #e0b0ff)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              margin: 0,
            }}
          >
            NFT 铸造控制台
          </h1>
          {/* 返回首页按钮 */}
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 22px',
              background: 'linear-gradient(135deg, rgba(87, 120, 247, 0.25), rgba(148, 63, 255, 0.35))',
              color: '#F6F8FF',
              border: '1px solid rgba(120, 145, 255, 0.35)',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              letterSpacing: '0.02em',
              transition: 'all 0.25s ease',
              boxShadow: '0 10px 24px rgba(94, 84, 242, 0.25)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 18px 30px rgba(94, 84, 242, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 24px rgba(94, 84, 242, 0.25)';
            }}
          >
            返回首页
          </button>
        </div>

        {/* 提示信息区域：成功或失败均在此显示 */}
        {message && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: message.includes('成功')
                ? 'linear-gradient(135deg, rgba(58, 186, 134, 0.28), rgba(28, 160, 90, 0.18))'
                : 'linear-gradient(135deg, rgba(244, 114, 94, 0.28), rgba(176, 49, 63, 0.18))',
              border: message.includes('成功')
                ? '1px solid rgba(107, 229, 183, 0.55)'
                : '1px solid rgba(244, 125, 101, 0.45)',
              color: message.includes('成功') ? '#bfffe4' : '#ffd9d2',
              boxShadow: '0 18px 35px rgba(14, 14, 50, 0.25)',
              marginBottom: '24px',
              fontSize: '14px',
              letterSpacing: '0.02em',
            }}
          >
            {message}
          </div>
        )}

        {/* 未连接账户时显示“连接钱包”按钮 */}
        {!account ? (
          <button
            onClick={connectWallet}
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: 'linear-gradient(120deg, #6e79ff, #9f63ff, #ff6fb1)',
              backgroundSize: '200% 200%',
              color: '#fff',
              border: 'none',
              borderRadius: '14px',
              cursor: 'pointer',
              boxShadow: '0 25px 45px rgba(122, 89, 255, 0.35)',
              transition: 'all 0.35s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundPosition = '100% 0%';
              e.currentTarget.style.boxShadow = '0 28px 55px rgba(122, 89, 255, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundPosition = '0% 100%';
              e.currentTarget.style.boxShadow = '0 25px 45px rgba(122, 89, 255, 0.35)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            连接钱包即刻开始
          </button>
        ) : (
          // 已连接账号后展示铸造相关内容
          <div>
            {/* 展示当前账号、持有数量、总供应量 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '18px',
                marginBottom: '32px',
              }}
            >
              <div
                style={{
                  padding: '18px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(102, 95, 255, 0.15), rgba(45, 167, 255, 0.12))',
                  border: '1px solid rgba(125, 143, 255, 0.3)',
                  boxShadow: '0 18px 45px rgba(32, 27, 72, 0.45)',
                }}
              >
                <div style={{ fontSize: '12px', opacity: 0.75, letterSpacing: '0.08em', textTransform: 'uppercase' }}>当前账户</div>
                <div style={{ fontSize: '15px', marginTop: '10px', wordBreak: 'break-all', color: '#d7ddff' }}>{account}</div>
              </div>
              <div
                style={{
                  padding: '18px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(80, 110, 255, 0.15), rgba(35, 210, 255, 0.12))',
                  border: '1px solid rgba(110, 142, 255, 0.3)',
                  boxShadow: '0 18px 45px rgba(25, 33, 78, 0.45)',
                }}
              >
                <div style={{ fontSize: '12px', opacity: 0.75, letterSpacing: '0.08em', textTransform: 'uppercase' }}>NFT 合约地址</div>
                <div style={{ fontSize: '15px', marginTop: '10px', wordBreak: 'break-all', color: '#dce9ff' }}>{NFT_CONTRACT_ADDRESS}</div>
              </div>
              <div
                style={{
                  padding: '18px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(111, 226, 190, 0.16), rgba(76, 165, 255, 0.12))',
                  border: '1px solid rgba(120, 231, 207, 0.3)',
                  boxShadow: '0 18px 45px rgba(22, 27, 68, 0.45)',
                }}
              >
                <div style={{ fontSize: '12px', opacity: 0.75, letterSpacing: '0.08em', textTransform: 'uppercase' }}>持有 NFT 数量</div>
                <div style={{ fontSize: '28px', fontWeight: 600, marginTop: '10px', color: '#e0fffb' }}>{nftBalance}</div>
              </div>
              <div
                style={{
                  padding: '18px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(252, 181, 108, 0.18), rgba(188, 103, 255, 0.16))',
                  border: '1px solid rgba(255, 194, 131, 0.35)',
                  boxShadow: '0 18px 45px rgba(41, 23, 58, 0.4)',
                }}
              >
                <div style={{ fontSize: '12px', opacity: 0.75, letterSpacing: '0.08em', textTransform: 'uppercase' }}>合约总供应量</div>
                <div style={{ fontSize: '28px', fontWeight: 600, marginTop: '10px', color: '#fff7e6' }}>{totalSupply}</div>
              </div>
            </div>

            {/* 铸造操作区域 */}
            <div
              style={{
                textAlign: 'center',
                marginBottom: '40px',
                padding: '32px 26px 36px',
                borderRadius: '22px',
                background: 'linear-gradient(140deg, rgba(38, 45, 82, 0.75), rgba(58, 65, 112, 0.68))',
                border: '1px solid rgba(143, 155, 255, 0.25)',
                boxShadow: '0 35px 65px rgba(7, 9, 18, 0.55)',
              }}
            >
              {/* NFT 预览图区域 */}
              <div
                style={{
                  width: '220px',
                  height: '220px',
                  borderRadius: '24px',
                  margin: '0 auto 26px',
                  overflow: 'hidden',
                  border: '1px solid rgba(148, 182, 255, 0.35)',
                  boxShadow: '0 28px 55px rgba(24, 39, 65, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundImage: 'linear-gradient(135deg, rgba(96, 107, 236, 0.18), rgba(160, 83, 255, 0.18))',
                }}
              >
                {imageError ? (
                  // 当预览图加载失败时展示的占位内容
                  <div style={{ color: '#9fbaff', fontSize: '20px', letterSpacing: '0.1em' }}>NFT 预览</div>
                ) : (
                  // 默认展示 1.jpg 作为示意图
                  <img
                    src={formatTokenUri('/img/1.jpg')}
                    alt='NFT Preview'
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    onError={() => setImageError(true)} // 加载失败时设置 imageError
                  />
                )}
              </div>

              {/* 铸造说明文字 */}
              <h3 style={{ color: '#eff2ff', marginBottom: '12px', fontSize: '24px', letterSpacing: '0.02em' }}>铸造您的 NFT</h3>
              <p style={{ color: '#a9b4df', fontSize: '14px', marginBottom: '26px', lineHeight: 1.6 }}>
                选择 1 - 5 个数量后，将直接调用合约批量铸造，多枚藏品会在一次交易中同步进入您的钱包。
              </p>

              {/* 铸造数量输入框 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '16px', color: '#9aa8da', marginRight: '10px' }}>铸造数量:</span>
                <input
                  type="number"
                  value={mintAmount}
                  onChange={handleMintAmountChange}
                  min="1"
                  max="5"
                  style={{
                    width: '60px',
                    padding: '8px 12px',
                    fontSize: '16px',
                    fontWeight: 600,
                    textAlign: 'center',
                    borderRadius: '10px',
                    border: '1px solid rgba(120, 145, 255, 0.35)',
                    background: 'rgba(120, 145, 255, 0.1)',
                    color: '#fff',
                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <span style={{ fontSize: '16px', color: '#9aa8da', marginLeft: '10px' }}>个</span>
              </div>

              {/* 铸造按钮 */}
              <button
                onClick={handleMint}
                disabled={loading}
                style={{
                  padding: '16px 44px',
                  fontSize: '18px',
                  fontWeight: 600,
                  background: loading
                    ? 'linear-gradient(120deg, rgba(126, 136, 191, 0.55), rgba(98, 107, 148, 0.45))'
                    : 'linear-gradient(120deg, #7a83ff, #a063ff, #ff77ba)',
                  backgroundSize: '200% 200%',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 23px 45px rgba(140, 102, 255, 0.45)',
                  transition: 'all 0.35s ease',
                  letterSpacing: '0.08em',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundPosition = '100% 0%';
                    e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)';
                    e.currentTarget.style.boxShadow = '0 28px 65px rgba(140, 102, 255, 0.55)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundPosition = '0% 100%';
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 23px 45px rgba(140, 102, 255, 0.45)';
                }}
              >
                {loading ? '铸造中...' : '立即铸造 NFT'}
              </button>
            </div>

            {/* 底部 NFT 列表区域仅在持有 NFT 时展示 */}
            {nftBalance > 0 && (
              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '30px',
                  borderTop: '1px solid rgba(184, 198, 255, 0.18)',
                }}
              >
                <h2
                  style={{
                    color: '#f2f5ff',
                    marginBottom: '16px',
                    textAlign: 'center',
                    fontSize: '22px',
                    letterSpacing: '0.04em',
                  }}
                >
                  我的 NFT 画廊（共 {nftBalance} 件）
                </h2>
                <p
                  style={{
                    textAlign: 'center',
                    color: '#98a6d9',
                    marginBottom: '22px',
                    fontSize: '13px',
                    letterSpacing: '0.03em',
                  }}
                >
                  每件作品均来自当前钱包实时查询，可点击查看元数据详情。
                </p>

                {/* 根据 loading 状态或列表长度给出不同提示 */}
                {loadingNFTs ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: '#9da8d8',
                      background: 'rgba(47, 55, 95, 0.45)',
                      borderRadius: '14px',
                      border: '1px solid rgba(114, 133, 209, 0.28)',
                    }}
                  >
                    正在加载我的 NFT，请稍候...
                  </div>
                ) : userNFTs.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: '#9da8d8',
                      background: 'rgba(47, 55, 95, 0.45)',
                      borderRadius: '14px',
                      border: '1px solid rgba(114, 133, 209, 0.28)',
                    }}
                  >
                    暂未找到属于我的 NFT
                  </div>
                ) : (
                  // 展示 NFT 卡片
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                      gap: '22px',
                      padding: '8px 4px 4px',
                    }}
                  >
                    {userNFTs.map((nft) => (
                      <div
                        key={nft.tokenId} // 使用 tokenId 作为唯一标识
                        style={{
                          borderRadius: '18px',
                          overflow: 'hidden',
                          background: 'linear-gradient(145deg, rgba(34, 45, 85, 0.88), rgba(24, 30, 64, 0.92))',
                          border: '1px solid rgba(148, 175, 255, 0.22)',
                          boxShadow: '0 22px 45px rgba(8, 12, 28, 0.55)',
                          transition: 'transform 0.28s ease, box-shadow 0.28s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-6px)';
                          e.currentTarget.style.boxShadow = '0 28px 65px rgba(8, 12, 28, 0.68)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 22px 45px rgba(8, 12, 28, 0.55)';
                        }}
                      >
                        {/* NFT 图片区域 */}
                        <div
                          style={{
                            width: '100%',
                            height: '170px',
                            overflow: 'hidden',
                            background: 'linear-gradient(135deg, rgba(123, 145, 255, 0.22), rgba(159, 118, 255, 0.24))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {nft.tokenURI ? (
                            <img
                              src={formatTokenUri(nft.tokenURI)} // 使用辅助函数处理 URI
                              alt={`NFT #${nft.tokenId}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none'; // 图片加载失败时隐藏 img
                                e.target.parentElement.innerHTML = '<div style="color: #a9b7ff; font-size: 14px;">图片加载失败</div>'; // 替换成文字提示
                              }}
                            />
                          ) : (
                            <div style={{ color: '#a9b7ff', fontSize: '14px' }}>未设置图片</div>
                          )}
                        </div>

                        {/* NFT 信息区域 */}
                        <div
                          style={{
                            padding: '12px 16px 14px',
                            textAlign: 'center',
                            background: 'rgba(14, 18, 32, 0.78)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#e5e9ff',
                              marginBottom: '6px',
                            }}
                          >
                            Token ID: {nft.tokenId}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#9aa8da',
                              wordBreak: 'break-all',
                            }}
                          >
                            {nft.tokenURI ? (
                              <a
                                href={nft.tokenURI}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: '#7f9fff',
                                  textDecoration: 'none',
                                  transition: 'color 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#aebcff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#7f9fff';
                                }}
                              >
                                查看元数据
                              </a>
                            ) : (
                              '未找到 URI'
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}