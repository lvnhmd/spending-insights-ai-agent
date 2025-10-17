'use client'

import { useState, useEffect } from 'react'
import { Clock, CheckCircle, AlertCircle, Zap } from 'lucide-react'

interface AutonomousRun {
  runType: string
  status: 'started' | 'completed' | 'failed'
  timestamp: string
  duration?: number
  usersProcessed?: number
  insightsGenerated?: number
  recommendationsCreated?: number
  errorMessage?: string
  lastRunDisplay?: string
}

export function AutonomousRunBadge() {
  const [latestRun, setLatestRun] = useState<AutonomousRun | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLatestRun()
    // Refresh every 30 seconds
    const interval = setInterval(fetchLatestRun, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchLatestRun = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || '/api'}/autonomous-runs/latest?runType=weekly-insights`
      )
      
      if (response.ok) {
        const data = await response.json()
        setLatestRun(data)
      }
    } catch (error) {
      console.error('Failed to fetch autonomous run data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600">
        <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600 mr-2"></div>
        Loading...
      </div>
    )
  }

  if (!latestRun) {
    return (
      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600">
        <Clock className="h-3 w-3 mr-2" />
        No autonomous runs yet
      </div>
    )
  }

  const getStatusIcon = () => {
    switch (latestRun.status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3 mr-2" />
      case 'failed':
        return <AlertCircle className="h-3 w-3 mr-2" />
      case 'started':
        return <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-2"></div>
      default:
        return <Clock className="h-3 w-3 mr-2" />
    }
  }

  const getStatusColor = () => {
    switch (latestRun.status) {
      case 'completed':
        return 'bg-success-100 text-success-700 border-success-200'
      case 'failed':
        return 'bg-danger-100 text-danger-700 border-danger-200'
      case 'started':
        return 'bg-primary-100 text-primary-700 border-primary-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${getStatusColor()}`}>
      <Zap className="h-3 w-3 mr-2" />
      <span className="font-medium">Last autonomous run:</span>
      <span className="mx-1">•</span>
      {getStatusIcon()}
      <span>
        {latestRun.recommendationsCreated || 0} recs
      </span>
      <span className="mx-1">•</span>
      <span>{formatDuration(latestRun.duration)}</span>
      <span className="mx-1">•</span>
      <span className="text-xs opacity-75">
        {formatTimestamp(latestRun.timestamp)}
      </span>
    </div>
  )
}