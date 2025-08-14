import React, { useState, useEffect } from 'react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../utils/firebase';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';

// Import questions from OnboardingPage
const questions = [
  { 
    id: 'occupation', 
    type: 'radio', 
    label: 'What is your occupation?', 
    options: ['Salaried', 'Freelancer', 'Business Owner', 'Student'], 
    hasOther: true 
  },
  { 
    id: 'monthly_income', 
    type: 'radio', 
    label: 'What is your average monthly income range?', 
    options: ['Less than ₹20,000', '₹20,000–₹50,000', '₹50,000–₹1,00,000', 'More than ₹1,00,000'] 
  },
  { 
    id: 'spending_behavior', 
    type: 'radio', 
    label: 'What is your monthly spending behavior?', 
    options: ['I spend most of what I earn', 'I save a small part regularly', 'I budget carefully and save', 'I do not track at all (yet)'] 
  },
  { 
    id: 'top_categories', 
    type: 'checkbox', 
    label: 'What are your top 3 spending categories?', 
    options: ['Rent', 'Food', 'Travel', 'Subscriptions', 'Shopping', 'Medical'], 
    hasOther: true 
  },
  { 
    id: 'expense_tracking', 
    type: 'radio', 
    label: 'Do you currently track your expenses?', 
    options: ['Yes – Manually', 'Yes – Using an app', 'No – but I want to start'] 
  },
  { 
    id: 'savings_goal', 
    type: 'radio', 
    label: 'Do you have any active savings goal (e.g., emergency fund, travel)?', 
    options: ['Yes – I am saving for something', 'No – Not yet', 'I want help starting one'] 
  },
  { 
    id: 'financial_support', 
    type: 'checkbox', 
    label: 'What kind of financial support would you prefer?', 
    options: ['Smart Budgeting', 'Expense Alerts', 'Savings Suggestions', 'Personalized Recommendations'] 
  }
];

function SettingsPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    apiKey: '',
    password: ''
  });
  const [onboardingAnswers, setOnboardingAnswers] = useState({});
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const [loading, setLoading] = useState(false);
  const { currentUser, userData, setUserData } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        email: userData.email || '',
        apiKey: userData.apiKey || '',
        password: ''
      });
      setOnboardingAnswers(userData.onboardingAnswers || {});
    }
  }, [userData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOnboardingChange = (questionId, value, isOther = false) => {
    if (isOther) {
      setOnboardingAnswers(prev => ({
        ...prev,
        [`${questionId}_other`]: value
      }));
    } else {
      const question = questions.find(q => q.id === questionId);
      if (question.type === 'checkbox') {
        setOnboardingAnswers(prev => {
          const currentAnswers = prev[questionId] || [];
          if (currentAnswers.includes(value)) {
            return {
              ...prev,
              [questionId]: currentAnswers.filter(item => item !== value)
            };
          } else {
            return {
              ...prev,
              [questionId]: [...currentAnswers, value]
            };
          }
        });
      } else {
        setOnboardingAnswers(prev => ({
          ...prev,
          [questionId]: value
        }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update Firestore document
      const userDocRef = doc(db, "users", currentUser.uid);
      const updateData = {
        name: formData.name,
        apiKey: formData.apiKey
      };

      await updateDoc(userDocRef, updateData);

      // Update password if provided
      if (formData.password) {
        await updatePassword(currentUser, formData.password);
      }

      // Update local state
      setUserData(prev => ({
        ...prev,
        ...updateData
      }));

      showToast('Settings saved successfully!', 'success');
      setFormData(prev => ({ ...prev, password: '' }));
    } catch (error) {
      console.error("Error updating settings:", error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSubmit = async () => {
    setLoading(true);

    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, {
        onboardingAnswers: onboardingAnswers
      });

      setUserData(prev => ({
        ...prev,
        onboardingAnswers: onboardingAnswers
      }));

      showToast('Preferences updated successfully!', 'success');
      setEditingOnboarding(false);
    } catch (error) {
      console.error("Error updating onboarding answers:", error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderOnboardingAnswer = (question) => {
    const answer = onboardingAnswers[question.id];
    const otherAnswer = onboardingAnswers[`${question.id}_other`];
    
    if (!answer) return <span className="text-light-subtle dark:text-brand-subtle">Not answered</span>;
    
    if (Array.isArray(answer)) {
      return (
        <span className="text-light-text dark:text-brand-text">
          {answer.join(', ')}
          {answer.includes('Other') && otherAnswer && ` (${otherAnswer})`}
        </span>
      );
    }
    
    return (
      <span className="text-light-text dark:text-brand-text">
        {answer}
        {answer === 'Other' && otherAnswer && ` (${otherAnswer})`}
      </span>
    );
  };

  const renderEditableQuestion = (question) => {
    return (
      <div className="space-y-2">
        {question.options.map(option => (
          <label key={option} className="flex items-center p-3 border border-light-tertiary dark:border-brand-tertiary rounded-lg cursor-pointer hover:bg-light-tertiary dark:hover:bg-brand-tertiary transition">
            <input
              type={question.type}
              name={question.id}
              value={option}
              checked={
                question.type === 'radio' 
                  ? onboardingAnswers[question.id] === option
                  : (onboardingAnswers[question.id] || []).includes(option)
              }
              onChange={() => handleOnboardingChange(question.id, option)}
              className="mr-3"
            />
            <span className={(onboardingAnswers[question.id] === option || (onboardingAnswers[question.id] || []).includes(option)) ? 'text-accent font-semibold' : ''}>
              {option}
            </span>
          </label>
        ))}
        
        {question.hasOther && (
          <label className="flex items-center p-3 border border-light-tertiary dark:border-brand-tertiary rounded-lg cursor-pointer hover:bg-light-tertiary dark:hover:bg-brand-tertiary transition">
            <input
              type={question.type}
              name={question.id}
              value="Other"
              checked={
                question.type === 'radio' 
                  ? onboardingAnswers[question.id] === 'Other'
                  : (onboardingAnswers[question.id] || []).includes('Other')
              }
              onChange={() => handleOnboardingChange(question.id, 'Other')}
              className="mr-3"
            />
            <span className="mr-2">Other:</span>
            <input
              type="text"
              placeholder="Please specify"
              value={onboardingAnswers[`${question.id}_other`] || ''}
              onChange={(e) => handleOnboardingChange(question.id, e.target.value, true)}
              className="flex-grow p-2 bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-md text-sm"
              onFocus={() => handleOnboardingChange(question.id, 'Other')}
            />
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Settings" showProfile={true} showMenu={true} />
      
      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Profile Settings Section */}
          <section className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-accent mb-6">Profile Settings</h2>
                <div className="space-y-4">
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
                      value={formData.email}
                      disabled 
                      className="mt-1 block w-full bg-light-tertiary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 text-light-subtle dark:text-brand-subtle cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="text-sm font-medium text-light-subtle dark:text-brand-subtle">New Password (leave blank to keep current)</label>
                    <input 
                      type="password" 
                      id="password" 
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition" 
                      placeholder="••••••••"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="apiKey" className="text-sm font-medium text-light-subtle dark:text-brand-subtle">API Key</label>
                    <input 
                      type="text" 
                      id="apiKey" 
                      name="apiKey"
                      value={formData.apiKey}
                      onChange={handleChange}
                      required 
                      className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                    />
                    <p className="mt-1 text-xs text-light-subtle dark:text-brand-subtle">Your API key for AI-powered financial insights.</p>
                  </div>
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Saving...
                  </>
                ) : (
                  'Save Profile Changes'
                )}
              </button>
            </form>
          </section>

          {/* Financial Preferences Section */}
          <section className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-accent">Financial Preferences</h2>
              {!editingOnboarding && (
                <button
                  onClick={() => setEditingOnboarding(true)}
                  className="text-accent hover:text-opacity-80 transition"
                >
                  <i className="fa-solid fa-pen-to-square mr-2"></i>
                  Edit
                </button>
              )}
            </div>

            <div className="space-y-6">
              {questions.map((question) => (
                <div key={question.id} className="border-b border-light-tertiary dark:border-brand-tertiary pb-4 last:border-0">
                  <h3 className="font-semibold text-light-text dark:text-brand-text mb-2">
                    {question.label}
                  </h3>
                  {editingOnboarding ? (
                    renderEditableQuestion(question)
                  ) : (
                    renderOnboardingAnswer(question)
                  )}
                </div>
              ))}
            </div>

            {editingOnboarding && (
              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleOnboardingSubmit}
                  disabled={loading}
                  className="flex-1 bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                      Saving...
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditingOnboarding(false);
                    setOnboardingAnswers(userData.onboardingAnswers || {});
                  }}
                  disabled={loading}
                  className="flex-1 bg-light-tertiary dark:bg-brand-tertiary font-bold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-brand-primary transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default SettingsPage;