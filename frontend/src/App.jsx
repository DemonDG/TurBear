import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './HomePage';
import MintPage from './MintPage';
import DeFi from './DeFi';
import NFTMintPage from './NFTMintPage';
import TokenTracker from './TokenTracker';
import Launchpad from './Launchpad';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/mint" element={<MintPage />} />
        <Route path="/defi" element={<DeFi />} />
        <Route path="/nft" element={<NFTMintPage />} />
        <Route path="/tracker" element={<TokenTracker />} />
        <Route path="/launchpad" element={<Launchpad />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}


