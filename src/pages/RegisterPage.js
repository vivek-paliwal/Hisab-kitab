import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { useToast } from '../contexts/ToastContext';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';

function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    apiKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        apiKey: formData.apiKey,
        createdAt: serverTimestamp(),
        onboardingComplete: false
      });

      showToast('Registration successful! Redirecting...', 'success');
      
      setTimeout(() => {
        navigate('/onboarding');
      }, 1500);

    } catch (error) {
      console.error("Registration Error:", error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApiKeyInfo = () => {
    window.open('https://aistudio.google.com/apikey', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Hisab-Kitab" />
      
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl">
            <h2 className="text-2xl font-bold text-center text-light-text dark:text-brand-text mb-2">Create Your Account</h2>
            <p className="text-center text-light-subtle dark:text-brand-subtle mb-8">Get started with Hisab-Kitab</p>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Full Name</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Email Address</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Password</label>
                <input 
                  type="password" 
                  id="password" 
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Confirm Password</label>
                <input 
                  type="password" 
                  id="confirmPassword" 
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              
              <div className="relative">
                <div className="flex justify-between items-center">
                  <label htmlFor="apiKey" className="text-sm font-medium text-light-subtle dark:text-brand-subtle">API Key</label>
                  <div 
                    className="relative"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    <button 
                      type="button"
                      onClick={handleApiKeyInfo}
                      className="text-xs font-medium text-accent hover:underline flex items-center"
                    >
                      <i className="fa-solid fa-info-circle mr-1"></i>
                      Get API Key
                    </button>
                    
                    {/* Tooltip */}
                    {showTooltip && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg shadow-xl p-4 z-10">
                        <div className="text-xs text-light-text dark:text-brand-text">
                          <div className="font-semibold mb-2 text-accent">Steps to get API Key:</div>
                          <ol className="space-y-1 list-decimal list-inside">
                            <li>Login to your Google account</li>                       
                            <li>Click "Create API Key" & Wait</li>
                            <li>Scroll & Copy the generated API key</li>
                            <li>Paste it in the field below</li>
                          </ol>
                        </div>
                        {/* Arrow pointing up */}
                        <div className="absolute -top-2 right-4 w-4 h-4 bg-light-primary dark:bg-brand-tertiary border-l border-t border-light-tertiary dark:border-brand-primary transform rotate-45"></div>
                      </div>
                    )}
                  </div>
                </div>
                <input 
                  type="text" 
                  id="apiKey" 
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleChange}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                  placeholder="Paste your Google API key here"
                />
                <p className="mt-1 text-xs text-light-subtle dark:text-brand-subtle">An API key is required to enable AI-powered financial insights.</p>
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Creating Account...
                  </>
                ) : (
                  'Register'
                )}
              </button>
            </form>
            
            <p className="text-center text-sm text-light-subtle dark:text-brand-subtle mt-8">
              Already have an account? <Link to="/login" className="font-semibold text-accent hover:underline">Login here</Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default RegisterPage;