import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useSupabase } from '../hooks/useSupabase';
import { Account, SalesData, User as UserType, IncentiveRule } from '../types';

interface IncentiveOverviewProps {
  currentUser?: UserType;
}

const IncentiveOverview: React.FC<IncentiveOverviewProps> = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [incentiveRules, setIncentiveRules] = useState<IncentiveRule[]>([]);

  const {
    fetchAccounts,
    fetchSalesData,
    fetchUsers,
    fetchIncentiveRules,
  } = useSupabase();

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [accountsData, salesDataResult, usersData, rulesData] = await Promise.all([
          fetchAccounts(),
          fetchSalesData(),
          fetchUsers(),
          fetchIncentiveRules(),
        ]);
        
        setAccounts(accountsData);
        setSalesData(salesDataResult);
        setUsers(usersData);
        setIncentiveRules(rulesData);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Get active incentive rule
  const activeRule = useMemo(() => {
    return incentiveRules.find(rule => rule.is_active) || null;
  }, [incentiveRules]);

  // Calculate tiered incentive
  const calculateTieredIncentive = (revenue: number, rule: IncentiveRule): number => {
    if (revenue < rule.base_revenue_threshold) return 0;

    // Apply tiered rates
    const sortedTiers = [...rule.tiers].sort((a, b) => a.revenue_threshold - b.revenue_threshold);

    // Find which tier applies based on revenue
    let applicableTier = sortedTiers[0];
    for (const tier of sortedTiers) {
      if (revenue >= tier.revenue_threshold) {
        applicableTier = tier;
      } else {
        break;
      }
    }

    // Calculate incentive using the applicable tier's rate
    const incentive = (revenue * applicableTier.incentive_rate) / 100;

    return incentive;
  };

  // Calculate user accounts overview with aggregated metrics
  const userAccountsOverview = useMemo(() => {
    if (!activeRule) return [];

    const overview = users.map(user => {
      const userAccounts = accounts.filter(acc => acc.user_id === user.id);

      // Calculate aggregated metrics for all accounts of this user
      let totalRevenue = 0;
      let totalCommission = 0;
      let qualifyingAccountsCount = 0;

      userAccounts.forEach(account => {
        // Filter sales data for selected month/year
        const accountSales = salesData.filter(sale => {
          const saleDate = new Date(sale.date);
          return sale.account_id === account.id &&
                 saleDate.getMonth() + 1 === selectedMonth &&
                 saleDate.getFullYear() === selectedYear;
        });

        const accountCommission = accountSales.reduce((sum, sale) => sum + sale.gross_commission, 0);

        // Only count accounts that meet the min_commission_threshold
        if (accountCommission >= activeRule.min_commission_threshold) {
          const accountRevenue = accountSales.reduce((sum, sale) => sum + sale.total_purchases, 0);
          totalRevenue += accountRevenue;
          totalCommission += accountCommission;
          qualifyingAccountsCount++;
        }
      });

      const avgCommissionRate = totalRevenue > 0 ? Number(((totalCommission / totalRevenue) * 100).toFixed(4)) : 0;

      return {
        user_id: user.id,
        user_name: user.name,
        total_accounts: userAccounts.length,
        qualifying_accounts: qualifyingAccountsCount,
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        avg_commission_rate: avgCommissionRate,
      };
    });
    return overview.sort((a, b) => b.total_revenue - a.total_revenue);
  }, [users, accounts, salesData, selectedMonth, selectedYear, activeRule]);

  // Month names in Indonesian
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const fullMonthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Function to determine which quest/rule category a user belongs to
  const getUserQuestCategory = (avgCommissionRate: number) => {
    if (!activeRule) return null;

    const midPoint = 6.5;

    if (avgCommissionRate >= activeRule.commission_rate_min && avgCommissionRate <= activeRule.commission_rate_max) {
      const maxDisplay = activeRule.commission_rate_max === 100 ? '∞' : activeRule.commission_rate_max + '%';

      if (avgCommissionRate < midPoint) {
        return { category: 'Standard Commission', range: `${activeRule.commission_rate_min}% - ${maxDisplay}`, color: 'bg-blue-100 text-blue-800' };
      } else {
        return { category: 'High Commission', range: `${activeRule.commission_rate_min}% - ${maxDisplay}`, color: 'bg-purple-100 text-purple-800' };
      }
    }
    return { category: 'Not Qualifying', range: 'Outside range', color: 'bg-gray-100 text-gray-800' };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleMonthSelect = (month: number) => {
    setSelectedMonth(month);
    setShowDatePicker(false);
  };

  const handleYearChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedYear(selectedYear + 1);
    }
  };

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Incentive Overview</h1>
            <p className="text-gray-600">Loading incentive calculations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incentive Overview</h1>
          <p className="text-gray-600">Monthly incentive calculations based on tiered commission structure</p>
        </div>
        
        {/* Date Filter */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Period:</span>
          </div>
          
          {/* Year Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleYearChange('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Previous Year"
            >
              <ChevronUp className="w-4 h-4 rotate-[-90deg] text-gray-600" />
            </button>
            <span className="text-lg font-semibold text-gray-900 min-w-[60px] text-center">
              {selectedYear}
            </span>
            <button
              onClick={() => handleYearChange('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Next Year"
            >
              <ChevronUp className="w-4 h-4 rotate-90 text-gray-600" />
            </button>
          </div>
          
          {/* Date Picker Button */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-w-[160px]"
            >
              <span className="text-sm font-medium text-gray-900">
                {fullMonthNames[selectedMonth - 1]}
              </span>
              <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Date Picker Dropdown */}
            {showDatePicker && (
              <div className="absolute top-full right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 min-w-[320px]">
                {/* Month Header */}
                <div className="text-center mb-4">
                  <h3 className="text-sm font-medium text-gray-700">Select Month</h3>
                </div>

                {/* Months Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {monthNames.map((month, index) => (
                    <button
                      key={index}
                      onClick={() => handleMonthSelect(index + 1)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        selectedMonth === index + 1
                          ? 'bg-blue-500 text-white'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Accounts Overview */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">User Accounts Overview</h3>
          <p className="text-sm text-gray-600 mt-1">
            Aggregated performance for {fullMonthNames[selectedMonth - 1]} {selectedYear}
          </p>
        </div>

        {userAccountsOverview.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qualifying Accounts
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Commission
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Rate (%)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quest Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Incentive Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {userAccountsOverview.map((userOverview) => (
                  <tr key={userOverview.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{userOverview.user_name}</div>
                          <div className="text-xs text-gray-500">
                            {userOverview.qualifying_accounts} of {userOverview.total_accounts} accounts
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
                        {userOverview.qualifying_accounts}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {formatCurrency(userOverview.total_revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {formatCurrency(userOverview.total_commission)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {userOverview.avg_commission_rate.toFixed(4)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {(() => {
                        const questInfo = getUserQuestCategory(userOverview.avg_commission_rate);
                        return questInfo ? (
                          <div className="space-y-1">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${questInfo.color}`}>
                              {questInfo.category}
                            </span>
                            <div className="text-xs text-gray-500">
                              {questInfo.range}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No active rule</span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {(() => {
                        if (!activeRule || userOverview.total_revenue < activeRule.base_revenue_threshold) {
                          return <span className="text-sm text-gray-400">-</span>;
                        }
                        const incentive = calculateTieredIncentive(userOverview.total_revenue, activeRule);
                        return (
                          <div className="text-sm font-semibold text-green-600">
                            {formatCurrency(incentive)}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Found</h3>
            <p className="text-gray-600">No users available in the system</p>
          </div>
        )}
      </div>

      {/* Click outside to close date picker */}
      {showDatePicker && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
};

export default IncentiveOverview;
