import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../utils/firebase';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';

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

function OnboardingPage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [questionHistory, setQuestionHistory] = useState([0]);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercentage = ((currentQuestionIndex + 1) / questions.length) * 100;

  const handleAnswerChange = (questionId, value, isOther = false) => {
    if (isOther) {
      setUserAnswers(prev => ({
        ...prev,
        [`${questionId}_other`]: value
      }));
    } else {
      if (currentQuestion.type === 'checkbox') {
        setUserAnswers(prev => {
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
        setUserAnswers(prev => ({
          ...prev,
          [questionId]: value
        }));
      }
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex === questions.length - 1) {
      finishOnboarding();
      return;
    }
    
    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    setQuestionHistory(prev => [...prev, nextIndex]);
  };

  const goToPreviousQuestion = () => {
    if (questionHistory.length > 1) {
      const newHistory = [...questionHistory];
      newHistory.pop();
      const prevIndex = newHistory[newHistory.length - 1];
      setCurrentQuestionIndex(prevIndex);
      setQuestionHistory(newHistory);
    }
  };

  const finishOnboarding = async () => {
    if (!currentUser) {
      showToast('You are not logged in. Redirecting...', 'error');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }

    setLoading(true);
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, {
        onboardingAnswers: userAnswers,
        onboardingComplete: true,
        personalizationComplete: false
      });
      navigate('/welcome');
    } catch (error) {
      console.error("Error saving onboarding data: ", error);
      showToast('Could not save your data. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = () => {
    const q = currentQuestion;
    
    return (
      <div className="min-h-[250px]">
        <label className="block font-weight-600 mb-6 text-xl text-light-text dark:text-brand-text">
          {q.label}
        </label>
        
        {(q.type === 'radio' || q.type === 'checkbox') && (
          <div className="space-y-3">
            {q.options.map(option => (
              <label key={option} className="flex items-center p-4 border border-light-tertiary dark:border-brand-tertiary rounded-lg cursor-pointer hover:bg-light-tertiary dark:hover:bg-brand-tertiary transition">
                <input
                  type={q.type}
                  name={q.id}
                  value={option}
                  checked={
                    q.type === 'radio' 
                      ? userAnswers[q.id] === option
                      : (userAnswers[q.id] || []).includes(option)
                  }
                  onChange={() => handleAnswerChange(q.id, option)}
                  className="mr-3"
                />
                <span className={userAnswers[q.id] === option || (userAnswers[q.id] || []).includes(option) ? 'text-accent font-semibold' : ''}>
                  {option}
                </span>
              </label>
            ))}
            
            {q.hasOther && (
              <label className="flex items-center p-4 border border-light-tertiary dark:border-brand-tertiary rounded-lg cursor-pointer hover:bg-light-tertiary dark:hover:bg-brand-tertiary transition">
                <input
                  type={q.type}
                  name={q.id}
                  value="Other"
                  checked={
                    q.type === 'radio' 
                      ? userAnswers[q.id] === 'Other'
                      : (userAnswers[q.id] || []).includes('Other')
                  }
                  onChange={() => handleAnswerChange(q.id, 'Other')}
                  className="mr-3"
                />
                <span className="mr-2">Other:</span>
                <input
                  type="text"
                  placeholder="Please specify"
                  value={userAnswers[`${q.id}_other`] || ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value, true)}
                  className="flex-grow p-2 bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-md text-sm"
                  onFocus={() => handleAnswerChange(q.id, 'Other')}
                />
              </label>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Welcome!" />
      
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-2xl">
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl">
            <div className="mb-8">
              <div className="flex justify-between mb-1">
                <span className="text-base font-medium text-accent">Progress</span>
                <span className="text-sm font-medium text-accent">Step {currentQuestionIndex + 1} / {questions.length}</span>
              </div>
              <div className="w-full bg-light-tertiary dark:bg-brand-tertiary rounded-full h-2.5">
                <div 
                  className="bg-accent h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
            
            {renderQuestion()}

            <div className="mt-10 flex justify-between items-center">
              <button 
                onClick={goToPreviousQuestion}
                disabled={questionHistory.length === 1}
                className={`bg-light-tertiary dark:bg-brand-tertiary font-bold py-3 px-8 rounded-lg hover:bg-gray-300 dark:hover:bg-brand-primary transition ${questionHistory.length === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Back
              </button>
              
              <button 
                onClick={goToNextQuestion}
                disabled={loading}
                className="bg-accent text-white font-bold py-3 px-8 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Saving...
                  </>
                ) : (
                  currentQuestionIndex === questions.length - 1 ? 'Finish' : 'Next'
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default OnboardingPage;