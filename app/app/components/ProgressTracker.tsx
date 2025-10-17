'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Calendar, Target, CheckCircle } from 'lucide-react'

interface ProgressData {
  totalSavingsAchieved: number
  monthlyProgress: Array<{
    month: string
    savings: number
    recommendations: number
    implemented: number
  }>
  recentWins: Array<{
    date: string
    action: string
    savings: number
  }>
}

interface ProgressTrackerProps {
  userId: string
  implementedActions: string[]
  totalSavings: number
}

export function ProgressTracker({ userId, implementedActions, totalSavings }: ProgressTrackerProps) {
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In a real implementation, this would fetch actual progress data
    // For now, we'll generate mock data based on the props
    generateMockProgressData()
  }, [userId, implementedActions, totalSavings])

  const generateMockProgressData = () => {
    // Generate mock data for demonstration
    const mockData: ProgressData = {
      totalSavingsAchieved: Math.floor(totalSavings * 0.3), // Assume 30% of potential savings achieved
      monthlyProgress: [
        { month: 'Nov 2024', savings: 45.50, recommendations: 3, implemented: 2 },
        { month: 'Dec 2024', savings: 78.25, recommendations: 4, implemented: 3 },
        { month: 'Jan 2025', savings: Math.floor(totalSavings * 0.3), recommendations: 5, implemented: implementedActions.length },
      ],
      recentWins: [
        { date: '2025-01-15', action: 'Cancelled unused streaming subscription', savings: 12.99 },
        { date: '2025-01-10', action: 'Switched to generic brand groceries', savings: 23.45 },
        { date: '2025-01-05', action: 'Negotiated lower phone bill', savings: 15.00 },
      ].slice(0, implementedActions.length)
    }

    setProgressData(mockData)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!progressData) {
    return null
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Your Progress</h2>
      
      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="card p-6 bg-success-50 border-success-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-600 text-sm font-medium">Total Savings Achieved</p>
              <p className="text-3xl font-bold text-success-700">
                ${progressData.totalSavingsAchieved.toFixed(2)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-success-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Actions Implemented</p>
              <p className="text-3xl font-bold text-gray-900">
                {implementedActions.length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-primary-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Potential Remaining</p>
              <p className="text-3xl font-bold text-gray-900">
                ${(totalSavings - progressData.totalSavingsAchieved).toFixed(2)}
              </p>
            </div>
            <Target className="h-8 w-8 text-warning-600" />
          </div>
        </div>
      </div>

      {/* Monthly Progress Table */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Monthly Progress
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">Month</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Savings</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Recommendations</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Implemented</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {progressData.monthlyProgress.map((month, index) => (
                <tr key={month.month} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium text-gray-900">{month.month}</td>
                  <td className="py-3 px-4 text-right text-success-600 font-medium">
                    ${month.savings.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">{month.recommendations}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{month.implemented}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`badge ${
                      month.implemented / month.recommendations >= 0.7 
                        ? 'badge-success' 
                        : month.implemented / month.recommendations >= 0.4 
                        ? 'badge-warning' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {((month.implemented / month.recommendations) * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Wins */}
      {progressData.recentWins.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-success-600" />
            Recent Money Wins
          </h3>
          
          <div className="space-y-3">
            {progressData.recentWins.map((win, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-success-50 rounded-lg">
                <div className="flex items-center">
                  <div className="bg-success-100 rounded-full p-2 mr-3">
                    <CheckCircle className="h-4 w-4 text-success-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{win.action}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(win.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-success-600 font-semibold">
                  +${win.savings.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivation Section */}
      <div className="card p-6 bg-primary-50 border-primary-200">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-primary-800 mb-2">
            Keep Up the Great Work! 🎉
          </h3>
          <p className="text-primary-700 mb-4">
            You're on track to save ${(progressData.totalSavingsAchieved * 12).toFixed(2)} annually 
            by implementing our recommendations.
          </p>
          <div className="flex justify-center space-x-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-800">
                {implementedActions.length}
              </div>
              <div className="text-primary-600">Actions Taken</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-800">
                ${progressData.totalSavingsAchieved.toFixed(0)}
              </div>
              <div className="text-primary-600">Monthly Savings</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}