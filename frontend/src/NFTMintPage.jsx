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
  const [mintAmount, setMintAmount] = useState('1'); // 预留的铸造数量输入，目前默认为 1
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

    const amount = parseInt(mintAmount); // 将输入的铸造数量转成数字
    if (isNaN(amount) || amount <= 0) { // 简单校验数量
      setMessage('请输入有效的铸造数量'); // 提示用户输入有误
      return; // 直接返回
    }

    setLoading(true); // 设置按钮为加载状态
    setMessage(''); // 清空之前的提示信息

    try {
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, RarityNFTABI, signer); // 构造合约实例
      const userAddress = await signer.getAddress(); // 获取当前账户地址

      setMessage('正在发送交易...'); // 提示用户正在发送交易

      const tx = await nftContract.mint(userAddress); // 调用合约的 mint 方法

      setMessage('交易已发送，等待确认...'); // 提示交易已提交
      console.log('交易哈希:', tx.hash); // 控制台记录交易哈希

      const receipt = await tx.wait(); // 等待交易被链上确认

      if (receipt.status === 1) { // 交易成功
        setMessage(`✅ 成功铸造 NFT！交易哈希: ${tx.hash}`); // 显示成功消息
        await loadNFTData(signer); // 重新拉取最新的 NFT 数量
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
        maxWidth: 600, // 将内容区宽度限制在 600px 以内
        margin: '40px auto', // 设置上下间距并让内容水平居中
        fontFamily: 'sans-serif', // 使用通用的无衬线字体
        padding: '20px', // 设置容器内边距
        borderRadius: '10px', // 添加圆角
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)', // 添加轻微阴影以突出容器
      }}
    >
      {/* 页面顶部：标题和返回按钮 */}
      <div
        style={{
          display: 'flex', // 使用 flex 布局
          alignItems: 'center', // 垂直方向居中
          justifyContent: 'space-between', // 标题和按钮分列两侧
          marginBottom: '20px', // 与下方内容保持间距
        }}
      >
        {/* 标题显示当前页面功能 */}
        <h1 style={{ color: '#333' }}>NFT 铸造页面</h1>
        {/* 返回首页按钮 */}
        <button
          onClick={() => navigate('/')} // 点击时返回首页
          style={{
            padding: '8px 16px', // 设置按钮内边距
            backgroundColor: '#666', // 灰色背景
            color: 'white', // 白色文字
            border: 'none', // 移除按钮边框
            borderRadius: '4px', // 圆角处理
            cursor: 'pointer', // 鼠标悬停时显示为指针
          }}
        >
          返回首页
        </button>
      </div>

      {/* 提示信息区域：成功或失败均在此显示 */}
      {message && (
        <div
          style={{
            color: message.includes('成功') ? '#4CAF50' : '#f44336', // 成功用绿色，失败用红色
            marginBottom: '15px', // 与下方内容留白
          }}
        >
          {message}
        </div>
      )}

      {/* 未连接账户时显示“连接钱包”按钮 */}
      {!account ? (
        <button
          onClick={connectWallet} // 点击弹出钱包授权
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          连接钱包
        </button>
      ) : (
        // 已连接账号后展示铸造相关内容
        <div>
          {/* 展示当前账号、持有数量、总供应量 */}
          <div
            style={{
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#f5f5f5',
              borderRadius: '6px',
            }}
          >
            <div style={{ marginBottom: '10px' }}>账户: {account}</div>
            <div style={{ marginBottom: '10px' }}>已持有NFT数量: {nftBalance}</div>
            <div>合约总供应量: {totalSupply}</div>
          </div>

          {/* 铸造操作区域 */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            {/* NFT 预览图区域 */}
            <div
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '10px',
                margin: '0 auto 20px',
                overflow: 'hidden',
                border: '2px solid #1976d2',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: imageError ? '#e3f2fd' : 'transparent',
              }}
            >
              {imageError ? (
                // 当预览图加载失败时展示的占位内容
                <div style={{ color: '#1976d2', fontSize: '24px' }}>NFT 预览</div>
              ) : (
                // 默认展示 1.jpg 作为示意图
                <img
                  src='/img/1.jpg'
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
            <h3 style={{ color: '#1976d2', marginBottom: '15px' }}>铸造您的 NFT</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              每次可以铸造 1 个 NFT
            </p>

            {/* 铸造按钮 */}
            <button
              onClick={handleMint}
              disabled={loading}
              style={{
                padding: '15px 40px',
                fontSize: '18px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s',
              }}
              onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#1565c0')}
              onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#1976d2')}
            >
              {loading ? '铸造中...' : '铸造 NFT'}
            </button>
          </div>

          {/* 底部 NFT 列表区域仅在持有 NFT 时展示 */}
          {nftBalance > 0 && (
            <div
              style={{
                marginTop: '40px',
                paddingTop: '30px',
                borderTop: '2px solid #e0e0e0',
              }}
            >
              <h2
                style={{
                  color: '#333',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                我的 NFT 列表 ({nftBalance}){/* 显示当前拥有的数量 */}
              </h2>

              {/* 根据 loading 状态或列表长度给出不同提示 */}
              {loadingNFTs ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#666',
                  }}
                >
                  正在加载我的 NFT，请稍候...
                </div>
              ) : userNFTs.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#666',
                  }}
                >
                  暂未找到属于我的 NFT
                </div>
              ) : (
                // 展示 NFT 卡片
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '20px',
                    padding: '0 10px 10px',
                  }}
                >
                  {userNFTs.map((nft) => (
                    <div
                      key={nft.tokenId} // 使用 tokenId 作为唯一标识
                      style={{
                        border: '2px solid #1976d2',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        backgroundColor: '#fff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)'; // 鼠标悬浮时稍微上浮
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; // 改变阴影效果
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'; // 悬浮结束恢复位置
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; // 恢复原有阴影
                      }}
                    >
                      {/* NFT 图片区域 */}
                      <div
                        style={{
                          width: '100%',
                          height: '150px',
                          overflow: 'hidden',
                          backgroundColor: '#e3f2fd',
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
                              e.target.parentElement.innerHTML = '<div style="color: #1976d2; font-size: 14px;">图片加载失败</div>'; // 替换成文字提示
                            }}
                          />
                        ) : (
                          <div style={{ color: '#1976d2', fontSize: '14px' }}>未设置图片</div>
                        )}
                      </div>

                      {/* NFT 信息区域 */}
                      <div
                        style={{
                          padding: '10px',
                          textAlign: 'center',
                          backgroundColor: '#f5f5f5',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: '#333',
                            marginBottom: '6px',
                          }}
                        >
                          Token ID: {nft.tokenId}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#666',
                            wordBreak: 'break-all',
                          }}
                        >
                          {nft.tokenURI ? (
                            <a
                              href={nft.tokenURI}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#1976d2', textDecoration: 'none' }}
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
  );
}