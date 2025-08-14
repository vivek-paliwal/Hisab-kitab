import React from 'react';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';

function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="About Us" showProfile={true} showMenu={true} />
      
      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <section className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent mb-8">
            <h2 className="text-3xl font-bold text-accent mb-4">Our Mission</h2>
            <p className="text-light-subtle dark:text-brand-subtle leading-relaxed">
              At Hisab-Kitab, our mission is to empower individuals to take control of their financial lives through intuitive and powerful tools. We believe that financial literacy and effective expense management are the keys to achieving personal and financial goals. Our platform is designed to be simple, smart, and secure, helping you track your spending, create budgets, and gain valuable insights into your financial habits.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-bold text-accent mb-6 text-center">Meet the Founders</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
              <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent text-center">
                <img 
                  src="https://placehold.co/120x120/e9ecef/212529?text=NS" 
                  alt="Nitesh Sahani"
                  className="w-24 h-24 rounded-full mx-auto mb-4"
                />
                <h3 className="text-xl font-bold">Nitesh Sahani</h3>
                <p className="text-accent">CEO & Founder</p>
                <p className="text-sm text-light-subtle dark:text-brand-subtle mt-2">The visionary behind Hisab-Kitab, driving the mission to simplify finance for everyone.</p>
              </div>
              <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent text-center">
                <img 
                  src="https://placehold.co/120x120/e9ecef/212529?text=RP" 
                  alt="Rahul Patel"
                  className="w-24 h-24 rounded-full mx-auto mb-4"
                />
                <h3 className="text-xl font-bold">Rahul Patel</h3>
                <p className="text-accent">CTO & Co-Founder</p>
                <p className="text-sm text-light-subtle dark:text-brand-subtle mt-2">The engineering mastermind who ensures our platform is robust, secure, and cutting-edge.</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default AboutPage;