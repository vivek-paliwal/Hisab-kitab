import React, { useEffect, useRef } from 'react';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useTheme } from '../../contexts/ThemeContext';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Charts({ transactions }) {
  const { isDark } = useTheme();
  
  // Prepare expense data for doughnut chart
  const expenseData = transactions
    .filter(tx => tx.type === 'expense')
    .reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {});

  // Prepare monthly data for bar chart
  const monthlyData = transactions.reduce((acc, tx) => {
    const month = new Date(tx.date).toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!acc[month]) acc[month] = { income: 0, expense: 0 };
    acc[month][tx.type] += tx.amount;
    return acc;
  }, {});

  const sortedMonths = Object.keys(monthlyData).sort((a, b) => new Date(a) - new Date(b));

  const colors = isDark 
    ? { textColor: '#ecf0f1', gridColor: 'rgba(236, 240, 241, 0.1)', borderColor: '#1b263b' }
    : { textColor: '#212529', gridColor: 'rgba(33, 37, 41, 0.1)', borderColor: '#ffffff' };

  const doughnutData = {
    labels: Object.keys(expenseData),
    datasets: [{
      data: Object.values(expenseData),
      backgroundColor: ['#c0392b', '#ff9f1c', '#3498db', '#9b59b6', '#1abc9c', '#f1c40f', '#e67e22'],
      borderColor: colors.borderColor,
      borderWidth: 4
    }]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: colors.textColor
        }
      }
    },
    cutout: '60%'
  };

  const barData = {
    labels: sortedMonths,
    datasets: [
      {
        label: 'Income',
        data: sortedMonths.map(m => monthlyData[m].income),
        backgroundColor: 'rgba(39, 174, 96, 0.6)',
        borderRadius: 4
      },
      {
        label: 'Expense',
        data: sortedMonths.map(m => monthlyData[m].expense),
        backgroundColor: 'rgba(192, 57, 43, 0.6)',
        borderRadius: 4
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: colors.textColor
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: colors.textColor
        },
        grid: {
          color: colors.gridColor
        }
      },
      x: {
        ticks: {
          color: colors.textColor
        },
        grid: {
          color: 'transparent'
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
        <h3 className="text-lg font-bold text-accent mb-4">Expense Breakdown</h3>
        <div className="relative h-64">
          <Doughnut data={doughnutData} options={doughnutOptions} />
        </div>
      </div>
      <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
        <h3 className="text-lg font-bold text-accent mb-4">Income vs. Expense</h3>
        <div className="relative h-64">
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
    </div>
  );
}

export default Charts;