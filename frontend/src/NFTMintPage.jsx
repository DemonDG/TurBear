import React, { useState, useEffect } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { NFT_CONTRACT_ADDRESS } from './config';
import RarityNFTABI from './abi/RarityNFT.json';

export default function NFTMintPage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [mintAmount, setMintAmount] = useState('1');
  const [nftBalance, setNftBalance] = useState(0);
  const [totalSupply, setTotalSupply] = useState(0);
  const [imageError, setImageError] = useState(false);

  // 加载NFT数据
  const loadNFTData = async (signerInstance) => {
    if (!signerInstance) return;
    
    try {
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, RarityNFTABI, signerInstance);
      const balance = await nftContract.balanceOf(await signerInstance.getAddress());
      const supply = await nftContract.totalSupply();
      setNftBalance(Number(balance));
      setTotalSupply(Number(supply));
    } catch (error) {
      console.error('加载NFT数据失败:', error);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      const p = new BrowserProvider(window.ethereum);
      setProvider(p);
      
      // 自动连接钱包
      (async () => {
        try {
          const accs = await p.send('eth_accounts', []);
          if (accs && accs[0]) {
            const s = await p.getSigner();
            setSigner(s);
            setAccount(accs[0]);
          }
        } catch (error) {
          console.error('自动连接失败:', error);
        }
      })();

      // 监听账户变化
      window.ethereum.on?.('accountsChanged', async (accs) => {
        if (accs && accs[0]) {
          const s = await p.getSigner();
          setSigner(s);
          setAccount(accs[0]);
          await loadNFTData(s);
        } else {
          setSigner(null);
          setAccount('');
          setNftBalance(0);
        }
      });
    }
  }, []);

  // 当账户或signer变化时加载数据
  useEffect(() => {
    if (signer && account) {
      loadNFTData(signer);
    }
  }, [signer, account]);

  const connectWallet = async () => {
    if (!provider) return;
    try {
      const accs = await provider.send('eth_requestAccounts', []);
      const s = await provider.getSigner();
      setSigner(s);
      setAccount(accs[0]);
    } catch (error) {
      setMessage('连接钱包失败');
      console.error('连接钱包错误:', error);
    }
  };

  const handleMint = async () => {
    if (!signer) {
      setMessage('请先连接钱包');
      return;
    }

    const amount = parseInt(mintAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage('请输入有效的铸造数量');
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      // 连接到NFT合约
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, RarityNFTABI, signer);
      const userAddress = await signer.getAddress();
      
      setMessage('正在发送交易...');
      
      // 调用mint函数（每次只mint一个）
      const tx = await nftContract.mint(userAddress);
      
      setMessage('交易已发送，等待确认...');
      console.log('交易哈希:', tx.hash);
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        setMessage(`✅ 成功铸造 NFT！交易哈希: ${tx.hash}`);
        // 重新加载NFT数据
        await loadNFTData(signer);
      } else {
        setMessage('❌ 交易失败');
      }
      
    } catch (error) {
      console.error('铸造错误:', error);
      if (error.reason) {
        setMessage(`❌ 铸造失败: ${error.reason}`);
      } else if (error.message) {
        setMessage(`❌ 铸造失败: ${error.message}`);
      } else {
        setMessage('❌ NFT铸造失败，请检查网络连接和账户余额');
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{
      maxWidth: 600,
      margin: '40px auto',
      fontFamily: 'sans-serif',
      padding: '20px',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ color: '#333' }}>NFT 铸造页面</h1>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          返回首页
        </button>
      </div>
      
      {message && <div style={{ color: message.includes('成功') ? '#4CAF50' : '#f44336', marginBottom: '15px' }}>{message}</div>}
      
      {!account ? (
        <button
          onClick={connectWallet}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          连接钱包
        </button>
      ) : (
        <div>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
            <div style={{ marginBottom: '10px' }}>账户: {account}</div>
            <div style={{ marginBottom: '10px' }}>已持有NFT数量: {nftBalance}</div>
            <div>合约总供应量: {totalSupply}</div>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            {/* NFT图片预览 */}
            <div style={{
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
              backgroundColor: imageError ? '#e3f2fd' : 'transparent'
            }}>
              {imageError ? (
                <div style={{ color: '#1976d2', fontSize: '24px' }}>NFT 预览</div>
              ) : (
                <img 
                  src="/img/1.jpg" 
                  alt="NFT Preview" 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={() => setImageError(true)}
                />
              )}
            </div>
            
            <h3 style={{ color: '#1976d2', marginBottom: '15px' }}>铸造您的 NFT</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              每次可以铸造 1 个 NFT
            </p>
            
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
                transition: 'background-color 0.3s'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#1565c0')}
              onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#1976d2')}
            >
              {loading ? '铸造中...' : '铸造 NFT'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}