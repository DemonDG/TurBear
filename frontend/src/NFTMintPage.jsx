import React, { useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';
import { useNavigate } from 'react-router-dom';

export default function NFTMintPage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [mintAmount, setMintAmount] = useState('1');

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
        } else {
          setSigner(null);
          setAccount('');
        }
      });
    }
  }, []);

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
      // 这里只是模拟NFT铸造过程
      // 实际项目中需要连接到NFT合约并调用mint函数
      
      // 模拟网络请求延迟
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setMessage(`成功铸造 ${amount} 个NFT！`);
      
      // 模拟更新本地存储的NFT数量
      const currentNFTs = parseInt(localStorage.getItem(`nfts_${account}`) || '0');
      localStorage.setItem(`nfts_${account}`, (currentNFTs + amount).toString());
      
    } catch (error) {
      setMessage('NFT铸造失败');
      console.error('铸造错误:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNFTCount = () => {
    if (!account) return '0';
    return localStorage.getItem(`nfts_${account}`) || '0';
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
            <div>已持有NFT数量: {getNFTCount()}</div>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            {/* NFT图片预览 */}
            <div style={{
              width: '200px',
              height: '200px',
              backgroundColor: '#e3f2fd',
              borderRadius: '10px',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: '#1976d2'
            }}>
              NFT 预览
            </div>
            
            <h3 style={{ color: '#1976d2', marginBottom: '15px' }}>铸造您的 NFT</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>铸造数量:</label>
              <input
                type="number"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                min="1"
                max="10"
                disabled={loading}
                style={{
                  padding: '10px',
                  width: '100px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}
              />
            </div>
            
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