// Utility function for Indian currency formatting
export const formatCurrency = (amount, compact = false) => {
  if (!amount && amount !== 0) return '₹0';
  
  const absAmount = Math.abs(amount);
  
  if (compact && absAmount >= 10000000) { // 1 Crore
    const crores = absAmount / 10000000;
    return `₹${amount < 0 ? '-' : ''}${crores.toFixed(1)}CR`;
  } else if (compact && absAmount >= 100000) { // 1 Lakh
    const lakhs = absAmount / 100000;
    return `₹${amount < 0 ? '-' : ''}${lakhs.toFixed(1)}L`;
  } else if (compact && absAmount >= 1000) { // 1 Thousand
    const thousands = absAmount / 1000;
    return `₹${amount < 0 ? '-' : ''}${thousands.toFixed(1)}K`;
  } else {
    // Standard Indian numbering system
    return `₹${amount.toLocaleString('en-IN', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })}`;
  }
};

export const formatCurrencyDetailed = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  
  return `₹${amount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};