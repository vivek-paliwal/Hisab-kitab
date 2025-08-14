import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

function Header({ title = "Hisab-Kitab", showProfile = false, showMenu = false }) {
  const { currentUser, userData, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    // Add event listener when dropdown is open
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('') : 'U';
  };

  const isActivePage = (path) => {
    return location.pathname === path;
  };

  return (
    <header className="relative z-30 flex-shrink-0 bg-light-secondary/80 dark:bg-brand-secondary/50 backdrop-blur-sm p-4 flex items-center justify-between border-b border-light-tertiary dark:border-brand-tertiary">
      <div className="flex-1">
        <Link to={currentUser ? "/dashboard" : "/"}>
          <img 
            src="/logo.png"
            alt="Hisab-Kitab Logo" 
            className="h-16 w-auto"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://placehold.co/120x64/1b263b/ecf0f1?text=Logo';
            }}
          />
        </Link>
      </div>
      
      <div className="flex-1 text-center">
        <h1 className="text-3xl font-bold text-accent tracking-wider">{title}</h1>
      </div>
      
      <div className="flex-1 flex justify-end items-center gap-4">
        {showProfile && userData && (
          <div className="flex items-center gap-3">
            <img 
              src={`https://placehold.co/40x40/ff9f1c/ffffff?text=${getInitials(userData.name)}`}
              alt="Profile Picture" 
              className="w-10 h-10 rounded-full"
            />
            <div className="text-right">
              <div className="font-semibold text-sm">{userData.name}</div>
              <div className="flex items-center justify-end gap-2 text-xs text-light-subtle dark:text-brand-subtle">
                <div className="w-2.5 h-2.5 rounded-full bg-success transition-colors"></div>
                <span>AI Online</span>
              </div>
            </div>
          </div>
        )}

        {showMenu && (
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="bg-light-tertiary dark:bg-brand-tertiary text-light-text dark:text-brand-text font-bold w-10 h-10 rounded-lg hover:bg-gray-300 dark:hover:bg-brand-primary transition flex items-center justify-center"
            >
              <i className="fa-solid fa-ellipsis-v"></i>
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl shadow-2xl bg-light-secondary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary">
                <div className="py-1">
                  <button 
                    onClick={toggleTheme}
                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-light-text dark:text-brand-text hover:bg-light-tertiary dark:hover:bg-brand-secondary"
                  >
                    <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'} w-4`}></i>
                    <span>Toggle Theme</span>
                  </button>
                  
                  <Link 
                    to="/dashboard" 
                    className={`block px-4 py-2 text-sm text-light-text dark:text-brand-text hover:bg-light-tertiary dark:hover:bg-brand-secondary ${isActivePage('/dashboard') ? 'font-bold text-accent' : ''}`}
                    onClick={() => setShowDropdown(false)}
                  >
                    Dashboard
                  </Link>
                  
                  <Link 
                    to="/my-budget" 
                    className={`block px-4 py-2 text-sm text-light-text dark:text-brand-text hover:bg-light-tertiary dark:hover:bg-brand-secondary ${isActivePage('/my-budget') ? 'font-bold text-accent' : ''}`}
                    onClick={() => setShowDropdown(false)}
                  >
                    My Budget
                  </Link>
                  
                  <Link 
                    to="/saving-goals" 
                    className={`block px-4 py-2 text-sm text-light-text dark:text-brand-text hover:bg-light-tertiary dark:hover:bg-brand-secondary ${isActivePage('/saving-goals') ? 'font-bold text-accent' : ''}`}
                    onClick={() => setShowDropdown(false)}
                  >
                    Saving Goals
                  </Link>
                  
                  <Link 
                    to="/settings" 
                    className={`block px-4 py-2 text-sm text-light-text dark:text-brand-text hover:bg-light-tertiary dark:hover:bg-brand-secondary ${isActivePage('/settings') ? 'font-bold text-accent' : ''}`}
                    onClick={() => setShowDropdown(false)}
                  >
                    Settings
                  </Link>
                  
                  <Link 
                    to="/transactions" 
                    className={`block px-4 py-2 text-sm text-light-text dark:text-brand-text hover:bg-light-tertiary dark:hover:bg-brand-secondary ${isActivePage('/transactions') ? 'font-bold text-accent' : ''}`}
                    onClick={() => setShowDropdown(false)}
                  >
                    Transaction History
                  </Link>
                  
                  <Link 
                    to="/about" 
                    className={`block px-4 py-2 text-sm text-light-text dark:text-brand-text hover:bg-light-tertiary dark:hover:bg-brand-secondary ${isActivePage('/about') ? 'font-bold text-accent' : ''}`}
                    onClick={() => setShowDropdown(false)}
                  >
                    About Us
                  </Link>
                  
                  <button 
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-error hover:bg-light-tertiary dark:hover:bg-brand-secondary"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!showMenu && (
          <button 
            onClick={toggleTheme}
            className="bg-light-tertiary dark:bg-brand-tertiary text-light-text dark:text-brand-text font-bold w-10 h-10 rounded-lg hover:bg-gray-300 dark:hover:bg-brand-primary transition flex items-center justify-center"
          >
            <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'} w-4`}></i>
          </button>
        )}

        {!currentUser && location.pathname === '/' && (
          <Link 
            to="/login" 
            className="bg-accent text-white font-bold py-2 px-5 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}

export default Header;