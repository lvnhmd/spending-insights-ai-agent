'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, DollarSign, Target, Clock, CheckCircle } from 'lucide-react'

interface DailyInsight {
  id: string
  userId: string
  analysisDate: string
  analysisStartDate: string
  analysisEndDate: string
  totalSpent: number
  topCategories: Array<{
    category: string
    totalAmount: number
    transactionCount: number
    percentOfTotal: number
    averageAmount: number
  }>
  recommendations: Array<{
    id: string
    type: string
    title: string
    description: string
    potentialSavings: number
    difficulty: string
    priority: number
    actionSteps: string[]
    reasoning: string
    category?: string
    confidence: number
    estimatedTimeToImplement: string
    impact: string
  }>
  potentialSavings: number
  implementedActions: string[]
  generatedAt: string
  transactionCount: number
}

interface DailyInsightsProps {
  userId: string
}

export default function DailyInsights({ userId }: DailyInsightsProps) {
  const [insight, setInsight] = useState<DailyInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      fetchLatestInsight()
    }
  }, [userId])

  const fetchLatestInsight = async () => {
    try {
      setLoading(true)
      console.log('Fetching insights for user:', userId)
      const response = await fetch(`https://fwp452jpah.execute-api.us-east-1.amazonaws.com/prod/users/${userId}/insights?latest=true`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch insights: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Insights data received:', data)
      setInsight(data.insight)
      setError(null)
    } catch (err) {
      console.error('Error fetching insights:', err)
      setError(err instanceof Error ? err.message : 'Failed to load insights')
      setInsight(null)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchLatestInsight} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!insight) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No insights available yet</p>
            <Button onClick={fetchLatestInsight} variant="outline">
              Generate Insights
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Insights
              </CardTitle>
              <CardDescription>
                Analysis of {insight.transactionCount} transactions from {formatDate(insight.analysisStartDate)} to {formatDate(insight.analysisEndDate)}
              </CardDescription>
            </div>
            <Button onClick={fetchLatestInsight} variant="outline" size="sm">
              🔄 Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold">{formatCurrency(insight.totalSpent)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Potential Savings</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(insight.potentialSavings)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Recommendations</p>
                <p className="text-2xl font-bold">{insight.recommendations.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Top Spending Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insight.topCategories.map((category, index) => (
              <div key={category.category} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{category.category}</span>
                  <span className="text-sm text-gray-600">
                    {formatCurrency(category.totalAmount)} ({category.percentOfTotal.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={category.percentOfTotal} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{category.transactionCount} transactions</span>
                  <span>Avg: {formatCurrency(category.averageAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Personalized Recommendations</CardTitle>
          <CardDescription>
            AI-generated suggestions to optimize your spending
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insight.recommendations.map((rec, index) => (
              <Card key={rec.id} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{rec.title}</CardTitle>
                    <div className="flex gap-2">
                      <Badge className={getDifficultyColor(rec.difficulty)}>
                        {rec.difficulty}
                      </Badge>
                      <Badge className={getImpactColor(rec.impact)}>
                        {rec.impact} impact
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {formatCurrency(rec.potentialSavings)} potential savings
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {rec.estimatedTimeToImplement}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-3">{rec.description}</p>
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-2">Action Steps:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {rec.actionSteps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    <strong>AI Reasoning:</strong> {rec.reasoning}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}