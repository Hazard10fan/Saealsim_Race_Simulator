import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './SaealsimDashboard.jsx'; 
import './index.css'; // <-- 💡 지독했던 투박한 글씨 화면을 박살 낼 진짜 치트키! 물감 세트 연결선!

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);