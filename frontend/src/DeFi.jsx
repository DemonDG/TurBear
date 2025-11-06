import React, { useState, useEffect } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import ABI from './abi/BLToken.json';
import { CONTRACT_ADDRESS } from './config';
import { useNavigate } from 'react-router-dom';

export default function DeFi() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [balance, setBalance] = useState('0');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositedBalance, setDepositedBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
          await loadBalance();
        } else {
          setSigner(null);
          setAccount('');
          setBalance('0');
        }
      });
    }
  }, []);

  useEffect(() => {
    if (signer && CONTRACT_ADDRESS) {
      setContract(new Contract(CONTRACT_ADDRESS, ABI, signer));
      loadBalance();
    }
  }, [signer]);

  const connectWallet = async () => {
    if (!provider) return;
    try {
      const accs = await provider.send('eth_requestAccounts', []);
      const s = await provider.getSigner();
      setSigner(s);
      setAccount(accs[0]);
      await loadBalance();
    } catch (error) {
      setMessage('连接钱包失败');
      console.error('连接钱包错误:', error);
    }
  };

  const loadBalance = async () => {
    if (!contract || !account) return;
    try {
      const bal = await contract.balanceOf(account);
      setBalance((bal / 10**18).toString());
      // 获取本地存储的存款余额
      const deposited = parseFloat(localStorage.getItem(`deposited_${account}`) || '0');
      setDepositedBalance(deposited.toString());
    } catch (error) {
      console.error('加载余额失败:', error);
    }
  };

  const handleDeposit = async () => {
    if (!contract || !depositAmount || parseFloat(depositAmount) <= 0) {
      setMessage('请输入有效的存款金额');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      // 模拟存款操作
      const amount = parseFloat(depositAmount);
      const currentBalance = parseFloat(balance);
      
      if (amount > currentBalance) {
        setMessage('余额不足');
        return;
      }
      
      // 模拟更新本地存款余额
      const currentDeposited = parseFloat(localStorage.getItem(`deposited_${account}`) || '0');
      const newDeposited = currentDeposited + amount;
      localStorage.setItem(`deposited_${account}`, newDeposited.toString());
      
      setMessage('存款成功');
      await loadBalance();
      setDepositAmount('');
    } catch (error) {
      setMessage('存款失败');
      console.error('存款错误:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!contract || !depositAmount || parseFloat(depositAmount) <= 0) {
      setMessage('请输入有效的提款金额');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const amount = parseFloat(depositAmount);
      const currentDeposited = parseFloat(localStorage.getItem(`deposited_${account}`) || '0');
      
      if (amount > currentDeposited) {
        setMessage('提款金额超过存款余额');
        return;
      }
      
      // 模拟提款操作
      const newDeposited = currentDeposited - amount;
      localStorage.setItem(`deposited_${account}`, newDeposited.toString());
      
      setMessage('提款成功');
      await loadBalance();
      setDepositAmount('');
    } catch (error) {
      setMessage('提款失败');
      console.error('提款错误:', error);
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
        <h1 style={{ color: '#333' }}>简易存钱取钱 Demo</h1>
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
            <div style={{ marginBottom: '10px' }}>BL 代币余额: {balance} BL</div>
            <div>已存款: {depositedBalance} BL</div>
          </div>
          
          <div>
            <h3 style={{ color: '#4CAF50', marginBottom: '15px' }}>存款/提款操作</h3>
            <input
              type="number"
              placeholder="输入金额"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              disabled={loading}
              style={{
                padding: '10px',
                width: '100%',
                marginBottom: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleDeposit}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '处理中...' : '存入'}
              </button>
              <button
                onClick={handleWithdraw}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#ff9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '处理中...' : '取出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}