import React, { useEffect, useMemo, useState } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import ABI from './abi/BLToken.json';
import { CONTRACT_ADDRESS } from './config';
import { useNavigate } from 'react-router-dom';

export default function MintPage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [symbol, setSymbol] = useState('BL');
  const [decimals, setDecimals] = useState(18);
  const [balance, setBalance] = useState('0');
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chainId, setChainId] = useState('');
  const [message, setMessage] = useState('');

  const contract = useMemo(() => {
    if (!signer || !CONTRACT_ADDRESS) return null;
    try {
      return new Contract(CONTRACT_ADDRESS, ABI, signer);
    } catch {
      return null;
    }
  }, [signer]);

  useEffect(() => {
    if (window.ethereum) {
      const p = new BrowserProvider(window.ethereum);
      setProvider(p);
      // 若已授权，自动连接
      (async () => {
        try {
          const accs = await p.send('eth_accounts', []);
          if (accs && accs[0]) {
            const s = await p.getSigner();
            setSigner(s);
            setAccount(accs[0]);
          }
          const net = await p.getNetwork();
          setChainId(net.chainId.toString());
        } catch {}
      })();
      // 监听账户/网络切换
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
      window.ethereum.on?.('chainChanged', async () => {
        const net = await p.getNetwork();
        setChainId(net.chainId.toString());
        if (account) refresh();
      });
    }
  }, []);

  async function ensureSepolia() {
    if (!window.ethereum) return false;
    try {
      const net = await provider.getNetwork();
      if (net.chainId === 11155111n) return true;
      // 请求切换到 Sepolia
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // 11155111
      });
      return true;
    } catch (e) {
      setMessage('请切换到 Sepolia 网络');
      return false;
    }
  }

  async function connect() {
    if (!provider) return;
    setMessage('');
    const ok = await ensureSepolia();
    if (!ok) return;
    const accs = await provider.send('eth_requestAccounts', []);
    const s = await provider.getSigner();
    setSigner(s);
    setAccount(accs[0]);
  }

  async function refresh() {
    if (!contract || !account) return;
    try {
      const [sym, dec, bal] = await Promise.all([
        contract.symbol(),
        contract.decimals(),
        contract.balanceOf(account),
      ]);

      setSymbol(sym);
      setDecimals(Number(dec));
      setBalance(formatUnits(bal, Number(dec)));

      let ownerAddress = '';
      if (typeof contract.owner === 'function') {
        try {
          ownerAddress = await contract.owner();
        } catch (error) {
          console.warn('获取 owner 失败，可能合约未继承 Ownable:', error);
        }
      }
      if (ownerAddress) {
        setIsOwner(ownerAddress.toLowerCase() === account.toLowerCase());
      } else {
        setIsOwner(false);
      }
    } catch (error) {
      console.error('刷新余额失败:', error);
      setMessage(error?.reason || error?.message || '读取代币信息失败');
    }
  }

  async function onMint() {
    if (!contract) return;
    setLoading(true);
    try {
      const ok = await ensureSepolia();
      if (!ok) return;
      const tx = await contract.mint100();
      await tx.wait();
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    setMessage('已断开连接');
    setSigner(null);
    setAccount('');
    setBalance('0');
    setIsOwner(false);
  }

  useEffect(() => {
    if (contract && account) {
      refresh();
    }
  }, [contract, account]);

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>BL Token DApp</h2>
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
      
      {message && <div style={{color:'#c00', marginBottom: 8}}>{message}</div>}
      
      {!account ? (
        <button onClick={connect} style={{
          padding: '10px 20px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px'
        }}>连接 MetaMask</button>
      ) : (
        <div>
          <div style={{ marginBottom: '10px' }}>账户: {account}</div>
          <div style={{ marginBottom: '10px' }}>合约: {CONTRACT_ADDRESS}</div>
          <div style={{ marginBottom: '10px' }}>网络: {chainId === '11155111' ? 'Sepolia' : chainId}</div>
          <div style={{ marginBottom: '10px' }}>余额: {balance} {symbol}</div>
          <div style={{ marginBottom: '16px' }}>
            是否 Owner: {typeof contract?.owner === 'function' ? (isOwner ? '是' : '否') : '（合约未提供 owner）'}
          </div>
          <div style={{ marginTop: 16 }}>
            <button 
              onClick={onMint} 
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px'
              }}
            >
              {loading ? '处理中...' : 'Mint 100 ' + symbol}
            </button>
            <div style={{ marginTop: 12 }}>
              <button 
                onClick={disconnect}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >断开连接</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}