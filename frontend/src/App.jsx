import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ChatPage from './pages/ChatPage';
import ChartPage from './pages/ChartPage';
import FundamentalsPage from './pages/FundamentalsPage';
import ComparePage from './pages/ComparePage';
import WhatIfPage from './pages/WhatIfPage';
import JobsPage from './pages/JobsPage';

export default function App() {
  const location = useLocation();
  return (
    <Layout>
      <Routes location={location}>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chart" element={<ChartPage />} />
        <Route path="/fundamentals" element={<FundamentalsPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/what-if" element={<WhatIfPage />} />
        <Route path="/jobs" element={<JobsPage />} />
      </Routes>
    </Layout>
  );
}
