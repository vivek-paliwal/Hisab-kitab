import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserStatus = async () => {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (!userData.onboardingComplete) {
            navigate('/onboarding');
          } else if (!userData.personalizationComplete) {
            navigate('/personalize');
          } else {
            navigate('/dashboard');
          }
        }
      }
    };
    checkUserStatus();
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation will be handled by useEffect
    } catch (error) {
      console.error("Login Error:", error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      showToast('Please enter your email address first.', 'error');
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      showToast('Password reset email sent! Check your inbox.', 'success');
    } catch (error) {
      console.error("Password Reset Error:", error);
      showToast(error.message, 'error');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Hisab-Kitab" />
      
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl">
            <h2 className="text-2xl font-bold text-center text-light-text dark:text-brand-text mb-2">Welcome Back!</h2>
            <p className="text-center text-light-subtle dark:text-brand-subtle mb-8">Login to your account</p>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Email Address</label>
                <input 
                  type="email" 
                  id="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Password</label>
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                  >
                    {resetLoading ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin mr-1"></i>
                        Sending...
                      </>
                    ) : (
                      'Forgot Password?'
                    )}
                  </button>
                </div>
                <input 
                  type="password" 
                  id="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>
            
            <p className="text-center text-sm text-light-subtle dark:text-brand-subtle mt-8">
              Don't have an account? <Link to="/register" className="font-semibold text-accent hover:underline">Register here</Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default LoginPage;