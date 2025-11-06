import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  const handleMintClick = () => {
    navigate('/mint');
  };

  const handleDeFiClick = () => {
    navigate('/defi');
  };

  const handleNFTClick = () => {
    navigate('/nft');
  };

  return (
    <div style={{
      maxWidth: 600,
      margin: '40px auto',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      padding: '20px',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ color: '#333' }}>TurBear DApp 首页</h1>
      <p style={{ marginBottom: '30px', color: '#666' }}>选择您想要使用的功能：</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
        <button
          onClick={handleMintClick}
          style={{
            padding: '15px 40px',
            fontSize: '18px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '300px',
            transition: 'background-color 0.3s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#45a049'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#4CAF50'}
        >
          进入 Mint 页面
        </button>
        
        <button
          onClick={handleDeFiClick}
          style={{
            padding: '15px 40px',
            fontSize: '18px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '300px',
            transition: 'background-color 0.3s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#1976D2'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#2196F3'}
        >
          进入 DeFi 项目
        </button>
        
        <button
          onClick={handleNFTClick}
          style={{
            padding: '15px 40px',
            fontSize: '18px',
            backgroundColor: '#e91e63',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '300px',
            transition: 'background-color 0.3s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#c2185b'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#e91e63'}
        >
          铸造 NFT
        </button>
      </div>
    </div>
  );
}