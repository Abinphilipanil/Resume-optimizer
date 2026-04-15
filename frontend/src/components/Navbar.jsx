import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  
  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '70px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 40px',
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      zIndex: 1000
    }}>
      <Link to="/" style={{ 
        fontSize: '20px', 
        fontWeight: '700', 
        color: 'white', 
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          background: 'var(--primary)',
          borderRadius: '8px',
          boxShadow: '0 0 15px rgba(0, 210, 255, 0.4)'
        }}></div>
        ATS Builder
      </Link>
      
      <div style={{ display: 'flex', gap: '30px' }}>
        <Link to="/" style={{ 
          color: location.pathname === '/' ? 'var(--primary)' : '#94a3b8', 
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500',
          transition: '0.2s'
        }}>Home</Link>
        <Link to="/templates" style={{ 
          color: location.pathname === '/templates' ? 'var(--primary)' : '#94a3b8', 
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500'
        }}>Templates</Link>
        <Link to="/import" style={{ 
          color: location.pathname === '/import' ? 'var(--primary)' : '#94a3b8', 
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500'
        }}>ATS Scan</Link>
      </div>

      <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '14px' }} onClick={() => window.location.href = '/templates'}>
        Build Now
      </button>
    </nav>
  );
};

export default Navbar;
