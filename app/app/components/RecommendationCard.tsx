'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, DollarSign, Clock, Target, AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react'

interface Recommendation {
  id: string
  type: 'save' | 'invest' | 'eliminate_fee' | 'optimize'
  title: string
  description: string
  potentialSavings: number
  difficulty: 'easy' | 'medium' | 'hard'
  priority: number
  actionSteps: string[]
  reasoning: string
  category?: string
  confidence: number
  estimatedTimeToImplement: string
  impact: 'low' | 'medium' | 'high'
}

interface RecommendationCardProps {
  recommendation: Recommendation
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)

  const getTypeIcon = () => {
    switch (recommendation.type) {
      case 'save':
        return <DollarSign className="h-5 w-5" />
      case 'eliminate_fee':
        return <AlertTriangle className="h-5 w-5" />
      case 'optimize':
        return <TrendingUp className="h-5 w-5" />
      case 'invest':
        return <Target className="h-5 w-5" />
      default:
        return <Lightbulb className="h-5 w-5" />
    }
  }

  const getTypeColor = () => {
    switch (recommendation.type) {
      case 'save':
        return 'text-success-600 bg-success-50'
      case 'eliminate_fee':
        return 'text-warning-600 bg-warning-50'
      case 'optimize':
        return 'text-primary-600 bg-primary-50'
      case 'invest':
        return 'text-purple-600 bg-purple-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getDifficultyColor = () => {
    switch (recommendation.difficulty) {
      case 'easy':
        return 'text-success-600 bg-success-50'
      case 'medium':
        return 'text-warning-600 bg-warning-50'
      case 'hard':
        return 'text-danger-600 bg-danger-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getImpactColor = () => {
    switch (recommendation.impact) {
      case 'high':
        return 'text-success-600 bg-success-50'
      case 'medium':
        return 'text-warning-600 bg-warning-50'
      case 'low':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className={`p-2 rounded-lg ${getTypeColor()}`}>
            {getTypeIcon()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {recommendation.title}
            </h3>
            <p className="text-gray-600 text-sm">
              {recommendation.description}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-success-600">
            ${recommendation.potentialSavings.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">potential savings</div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`badge ${getDifficultyColor()}`}>
          {recommendation.difficulty}
        </span>
        <span className={`badge ${getImpactColor()}`}>
          {recommendation.impact} impact
        </span>
        <span className="badge bg-gray-50 text-gray-600">
          <Clock className="h-3 w-3 mr-1" />
          {recommendation.estimatedTimeToImplement}
        </span>
        {recommendation.category && (
          <span className="badge bg-primary-50 text-primary-600">
            {recommendation.category}
          </span>
        )}
      </div>

      {/* Action Steps Preview */}
      {recommendation.actionSteps.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Actions:</h4>
          <div className="text-sm text-gray-600">
            {recommendation.actionSteps.slice(0, showDetails ? undefined : 2).map((step, index) => (
              <div key={index} className="flex items-start mb-1">
                <span className="text-primary-600 mr-2">{index + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
            {!showDetails && recommendation.actionSteps.length > 2 && (
              <div className="text-primary-600 text-xs">
                +{recommendation.actionSteps.length - 2} more steps
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center text-sm text-primary-600 hover:text-primary-700"
        >
          {showDetails ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Show Details
            </>
          )}
        </button>
        
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className="flex items-center text-sm text-gray-600 hover:text-gray-700"
        >
          {showReasoning ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Hide Reasoning
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Why this recommendation?
            </>
          )}
        </button>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="space-y-4">
            {/* All Action Steps */}
            {recommendation.actionSteps.length > 2 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Complete Action Plan:</h4>
                <div className="space-y-2">
                  {recommendation.actionSteps.map((step, index) => (
                    <div key={index} className="flex items-start">
                      <span className="bg-primary-100 text-primary-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium mr-3 mt-0.5 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-700">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence and Priority */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Confidence:</span>
                <div className="flex items-center mt-1">
                  <div className="bg-gray-200 rounded-full h-2 w-full mr-2">
                    <div 
                      className="bg-primary-600 h-2 rounded-full"
                      style={{ width: `${recommendation.confidence * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-gray-900 font-medium">
                    {(recommendation.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-600">Priority:</span>
                <div className="text-gray-900 font-medium mt-1">
                  {recommendation.priority}/10
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Reasoning */}
      {showReasoning && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
              <Lightbulb className="h-4 w-4 mr-2" />
              Why this recommendation?
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              {recommendation.reasoning}
            </p>
            <div className="mt-3 text-xs text-gray-500">
              This explanation is generated by our AI agent to help you understand the recommendation.
            </div>
          </div>
        </div>
      )}

      {/* Investment Disclaimer */}
      {recommendation.type === 'invest' && (
        <div className="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
          <p className="text-xs text-warning-700">
            <strong>Educational Information Only:</strong> This is not financial advice. 
            Consult a licensed financial advisor before making investment decisions.
          </p>
        </div>
      )}
    </div>
  )
}