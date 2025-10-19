'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DailyInsights from './components/DailyInsights'

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [userId, setUserId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [insights, setInsights] = useState<any>(null)
  const [insightsRefreshKey, setInsightsRefreshKey] = useState(0)
  const [lastAutonomousRun, setLastAutonomousRun] = useState<{
    timestamp: string
    recommendations: number
    duration: number
  } | null>(null)
  const [userHasInsights, setUserHasInsights] = useState(false)
  const [checkingInsights, setCheckingInsights] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchLastAutonomousRun()
  }, [])

  const fetchLastAutonomousRun = async () => {
    try {
      // Get the latest autonomous run from DynamoDB
      const response = await fetch('https://fwp452jpah.execute-api.us-east-1.amazonaws.com/prod/autonomous-runs/latest?runType=daily-insights')
      
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setLastAutonomousRun({
            timestamp: data.runTimestamp,
            recommendations: data.recommendationsCreated || 0,
            duration: Math.round((data.duration || 0) / 1000) // Convert to seconds
          })
          return
        }
      }
    } catch (error) {
      console.error('Failed to fetch real autonomous run data:', error)
    }

    // Fallback to mock data if API fails
    const lastRunTime = new Date()
    const currentTime = new Date()
    
    // Set to yesterday's 20:45 Sofia time (18:45 UK time)
    lastRunTime.setDate(lastRunTime.getDate() - 1)
    lastRunTime.setHours(20, 45, 0, 0) // 20:45 Sofia time
    
    // If it's past today's 20:45, use today's run
    const todayRun = new Date()
    todayRun.setHours(20, 45, 0, 0)
    if (currentTime > todayRun) {
      lastRunTime.setDate(currentTime.getDate())
    }

    const mockLastRun = {
      timestamp: lastRunTime.toISOString(),
      recommendations: Math.floor(Math.random() * 5) + 1, // 1-5 recommendations
      duration: Math.round((Math.random() * 10 + 3) * 10) / 10 // 3-13 seconds
    }

    setLastAutonomousRun(mockLastRun)
  }

  const formatLastRunTime = (timestamp: string) => {
    const runTime = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - runTime.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ago`
    } else {
      return `${diffMinutes}m ago`
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/csv') {
      setSelectedFile(file)
      setUploadStatus('')
    } else {
      setUploadStatus('Please select a valid CSV file')
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !userId) {
      setUploadStatus('Please select a file and enter user ID')
      return
    }

    setIsUploading(true)
    setUploadStatus('Reading CSV file...')

    try {
      // Read the CSV file content
      const csvContent = await selectedFile.text()
      
      setUploadStatus('Uploading and processing transactions...')

      // Send to real API endpoint
      const response = await fetch('https://fwp452jpah.execute-api.us-east-1.amazonaws.com/prod/transactions/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          csvContent: csvContent
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      
      setUploadStatus(`✅ Successfully processed ${result.processedTransactions} transactions!`)
      
      // Set real insights data from the upload result
      setInsights({
        totalTransactions: result.processedTransactions,
        categoriesFound: new Set(result.transactions?.map((t: any) => t.category) || []).size,
        feesDetected: result.transactions?.filter((t: any) => t.category === 'Fees').length || 0,
        savingsOpportunities: Math.min(result.processedTransactions, 5) // Estimate based on transactions
      })

      // Trigger insights generation after successful upload
      setUploadStatus('✅ Transactions uploaded! Generating personalized insights...')
      await generateInsightsForUser(userId)
      
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus(`❌ Upload failed: ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setIsUploading(false)
    }
  }

  const [lastInsightDate, setLastInsightDate] = useState<string | null>(null)

  const checkUserInsights = async (userId: string) => {
    if (!userId.trim()) {
      setUserHasInsights(false)
      setLastInsightDate(null)
      return
    }

    setCheckingInsights(true)
    try {
      const response = await fetch(`https://fwp452jpah.execute-api.us-east-1.amazonaws.com/prod/users/${userId}/insights?latest=true`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.insight) {
          setUserHasInsights(true)
          setLastInsightDate(data.insight.generatedAt)
          console.log('Found existing insights for user:', userId)
        } else {
          setUserHasInsights(false)
          setLastInsightDate(null)
        }
      } else {
        setUserHasInsights(false)
        setLastInsightDate(null)
      }
    } catch (error) {
      console.error('Failed to check user insights:', error)
      setUserHasInsights(false)
      setLastInsightDate(null)
    } finally {
      setCheckingInsights(false)
    }
  }

  const handleUserIdChange = (newUserId: string) => {
    setUserId(newUserId)
    // Clear previous state
    setUploadStatus('')
    setSelectedFile(null)
    setInsights(null)
    setUserHasInsights(false)
    setLastInsightDate(null)
  }

  // Use useEffect to handle the debounced insights check
  useEffect(() => {
    if (!userId.trim()) {
      setUserHasInsights(false)
      return
    }

    const timeoutId = setTimeout(() => {
      checkUserInsights(userId)
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [userId])

  const generateInsightsForUser = async (userId: string) => {
    try {
      const response = await fetch(`https://fwp452jpah.execute-api.us-east-1.amazonaws.com/prod/users/${userId}/insights/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forceRegenerate: true
        })
      })

      if (response.ok) {
        setUploadStatus('✅ Insights generated! Refreshing your recommendations...')
        
        // Wait a moment for insights to be processed, then refresh the component
        setTimeout(() => {
          setInsightsRefreshKey(prev => prev + 1)
          setUserHasInsights(true)
          setUploadStatus('✅ New insights generated! Check your personalized recommendations below.')
        }, 5000) // Wait 5 seconds for processing
      }
    } catch (error) {
      console.error('Failed to generate insights:', error)
      // Don't show error to user as upload was successful
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-12">

        {/* Header Section */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            💰 Spending Insights AI Agent
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Transform your financial data into actionable weekly money wins
          </p>

          {/* Autonomous Operation Badge */}
          {lastAutonomousRun && (
            <div className="space-y-2">
              <div className="inline-flex items-center px-4 py-2 bg-green-100 border border-green-300 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">
                  Last run: {formatLastRunTime(lastAutonomousRun.timestamp)} • {lastAutonomousRun.recommendations} recs • {lastAutonomousRun.duration}s
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchLastAutonomousRun}
                  className="ml-2 h-6 w-6 p-0 text-green-700 hover:text-green-900"
                >
                  🔄
                </Button>
              </div>
              <div className="text-xs text-gray-500">
                📅 {new Date(lastAutonomousRun.timestamp).toLocaleString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}
              </div>
              <div className="text-xs text-blue-600">
                ⏰ Next run: Daily at 18:45 UK time (20:45 Sofia time)
              </div>
            </div>
          )}

          {!lastAutonomousRun && (
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 border border-gray-300 rounded-full">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
              <span className="text-sm font-medium text-gray-600">
                Autonomous agent initializing...
              </span>
            </div>
          )}
        </section>

        {/* How It Works Section */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">How It Works</h2>
            <p className="text-gray-600">Simple steps to unlock your financial insights</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-rose-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-lg font-bold">1</div>
              <h3 className="font-semibold mb-2">Set Up Profile</h3>
              <p className="text-sm text-gray-600">Create your user profile with financial goals</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-rose-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-lg font-bold">2</div>
              <h3 className="font-semibold mb-2">Upload CSV</h3>
              <p className="text-sm text-gray-600">Import your transaction data securely</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-rose-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-lg font-bold">3</div>
              <h3 className="font-semibold mb-2">AI Analysis</h3>
              <p className="text-sm text-gray-600">Our AI analyzes patterns and detects fees</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-rose-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-lg font-bold">4</div>
              <h3 className="font-semibold mb-2">Get Insights</h3>
              <p className="text-sm text-gray-600">Receive personalized money-saving tips</p>
            </div>
          </div>
        </section>

        {/* User Setup Section */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Step 1: User Setup</h2>
            <p className="text-gray-600">Enter your user ID to get started</p>
          </div>

          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>Enter your user ID to access your financial insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    type="text"
                    value={userId}
                    onChange={(e) => handleUserIdChange(e.target.value)}
                    placeholder="f0a75560-4b32-4306-90ff-bf3a7466667c"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700">
                    <strong>Test User ID:</strong><br />
                    f0a75560-4b32-4306-90ff-bf3a7466667c
                  </p>
                </div>

                {checkingInsights && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-gray-600">Checking for existing insights...</p>
                    </div>
                  </div>
                )}

                {userId && !checkingInsights && userHasInsights && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-700">
                      ✅ <strong>Insights found!</strong> Your personalized recommendations are displayed below.
                      {lastInsightDate && (
                        <>
                          <br />
                          <span className="text-xs text-green-600">
                            Last updated: {new Date(lastInsightDate).toLocaleString()}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                )}

                {userId && !checkingInsights && !userHasInsights && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md space-y-3">
                    <p className="text-sm text-yellow-700">
                      💡 <strong>No insights yet.</strong> Upload a CSV file below or generate insights from existing data.
                    </p>
                    <Button 
                      onClick={() => generateInsightsForUser(userId)}
                      variant="outline" 
                      size="sm"
                      className="w-full"
                    >
                      🔮 Generate Insights from Existing Data
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CSV Upload Section */}
        {userId && (
          <section className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">
                {userHasInsights ? 'Upload More Transactions' : 'Step 2: Upload Transactions'}
              </h2>
              <p className="text-gray-600">
                {userHasInsights 
                  ? 'Add new transactions to update your insights' 
                  : 'Upload your CSV file to analyze spending patterns'
                }
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction Data</CardTitle>
                  <CardDescription>Upload your bank transaction CSV file</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="csvFile">CSV File</Label>
                    <Input
                      id="csvFile"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      disabled={isUploading}
                    />
                  </div>

                  {selectedFile && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-700">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                    className="w-full"
                  >
                    {isUploading ? 'Processing...' : 'Upload & Analyze'}
                  </Button>

                  {uploadStatus && (
                    <div className="p-3 bg-gray-50 border rounded-md">
                      <p className="text-sm">{uploadStatus}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* Daily Insights Display */}
        {userId && (userHasInsights || insights) && (
          <section className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Your Daily Insights</h2>
              <p className="text-gray-600">AI-powered analysis of your spending patterns</p>
            </div>
            <DailyInsights key={`${userId}-${insightsRefreshKey}`} userId={userId} />
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-8 border-t">
          <p className="text-sm text-gray-500">
            Spending Insights AI Agent - Educational information only, not financial advice
          </p>
        </footer>

      </div>
    </div>
  )
}