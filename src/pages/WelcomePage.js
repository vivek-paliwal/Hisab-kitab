import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../utils/firebase';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';

function WelcomePage() {
  const { currentUser } = useAuth();
  const [nextStepUrl, setNextStepUrl] = useState('/personalize');
  const [buttonText, setButtonText] = useState('Personalize My Dashboard');

  useEffect(() => {
    const checkUserStatus = async () => {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.personalizationComplete) {
            setNextStepUrl('/dashboard');
            setButtonText('Go to My Dashboard');
          }
        }
      }
    };
    checkUserStatus();
  }, [currentUser]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Setup Complete!" />
      
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl">
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl text-center">
            
            <h2 className="text-4xl font-extrabold text-light-text dark:text-brand-text mb-3">Welcome to Hisab-Kitab!</h2>
            <p className="text-lg text-light-subtle dark:text-brand-subtle mb-10">You're all set to take control of your finances. One last step to personalize your experience.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
              <div className="bg-light-primary dark:bg-brand-primary p-6 rounded-xl border border-light-tertiary dark:border-brand-tertiary">
                <div className="flex items-center gap-4">
                  <div className="text-accent text-3xl"><i className="fa-solid fa-wand-magic-sparkles"></i></div>
                  <div>
                    <h3 className="font-bold text-lg">Personalize Your View</h3>
                    <p className="text-sm text-light-subtle dark:text-brand-subtle">Add your current balance and recent spending to get an instant dashboard view.</p>
                  </div>
                </div>
              </div>
              <div className="bg-light-primary dark:bg-brand-primary p-6 rounded-xl border border-light-tertiary dark:border-brand-tertiary">
                <div className="flex items-center gap-4">
                  <div className="text-accent text-3xl"><i className="fa-solid fa-chart-line"></i></div>
                  <div>
                    <h3 className="font-bold text-lg">Dashboard Overview</h3>
                    <p className="text-sm text-light-subtle dark:text-brand-subtle">Get a bird's-eye view of your income, expenses, and balance.</p>
                  </div>
                </div>
              </div>
            </div>

            <Link 
              to={nextStepUrl}
              className="bg-accent text-white font-bold py-4 px-12 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105 inline-block text-lg"
            >
              {buttonText}
            </Link>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default WelcomePage;