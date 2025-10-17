'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [userId, setUserId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [insights, setInsights] = useState<any>(null)
  const [lastAutonomousRun, setLastAutonomousRun] = useState<{
    timestamp: string
    recommendations: number
    duration: number
  } | null>(null)

  useEffect(() => {
    setMounted(true)
    fetchLastAutonomousRun()
  }, [])

  const fetchLastAutonomousRun = async () => {
    try {
      // TODO: Replace with actual API call to get latest autonomous run
      // const response = await fetch('/api/autonomous-runs/latest')
      // const data = await response.json()

      // For now, simulate realistic data based on the 4-hour schedule
      const lastRunTime = new Date()
      const currentHour = lastRunTime.getHours()

      // Calculate the last 4-hour interval (0, 4, 8, 12, 16, 20)
      const lastScheduledHour = Math.floor(currentHour / 4) * 4
      lastRunTime.setHours(lastScheduledHour, 0, 0, 0)

      // If current time is very close to a scheduled time, use previous interval
      if (new Date().getTime() - lastRunTime.getTime() < 5 * 60 * 1000) { // Less than 5 minutes
        lastRunTime.setHours(lastRunTime.getHours() - 4)
      }

      const mockLastRun = {
        timestamp: lastRunTime.toISOString(),
        recommendations: Math.floor(Math.random() * 5) + 1, // 1-5 recommendations
        duration: Math.round((Math.random() * 10 + 3) * 10) / 10 // 3-13 seconds
      }

      setLastAutonomousRun(mockLastRun)
    } catch (error) {
      console.error('Failed to fetch last autonomous run:', error)
    }
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
    setUploadStatus('Processing your transactions...')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('userId', userId)

      // For now, simulate the upload process
      await new Promise(resolve => setTimeout(resolve, 2000))

      setUploadStatus('✅ File processed successfully!')
      setInsights({
        totalTransactions: 45,
        categoriesFound: 8,
        feesDetected: 3,
        savingsOpportunities: 2
      })
    } catch (error) {
      setUploadStatus('❌ Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
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
                ⏰ Next run in ~{4 - (new Date().getHours() % 4)}h (every 4 hours: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
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
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="f0a75560-4b32-4306-90ff-bf3a7466667c"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700">
                    <strong>Test User ID:</strong><br />
                    f0a75560-4b32-4306-90ff-bf3a7466667c
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CSV Upload Section */}
        {userId && (
          <section className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Step 2: Upload Transactions</h2>
              <p className="text-gray-600">Upload your CSV file to analyze spending patterns</p>
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

        {/* Insights Display */}
        {insights && (
          <section className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Step 3: Your Insights</h2>
              <p className="text-gray-600">AI-powered analysis of your spending patterns</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-rose-600">{insights.totalTransactions}</div>
                  <p className="text-sm text-gray-600">Total processed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{insights.categoriesFound}</div>
                  <p className="text-sm text-gray-600">Spending categories</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Fees Detected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{insights.feesDetected}</div>
                  <p className="text-sm text-gray-600">Hidden charges</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Opportunities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{insights.savingsOpportunities}</div>
                  <p className="text-sm text-gray-600">Money-saving tips</p>
                </CardContent>
              </Card>
            </div>

            <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>💡 AI Recommendations</CardTitle>
                  <CardDescription>Personalized insights based on your spending patterns</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">🎯 Top Savings Opportunity</h4>
                    <p className="text-green-700 text-sm">
                      You could save $45/month by switching to a different subscription plan for your streaming services.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Why this recommendation?
                    </Button>
                  </div>

                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">⚠️ Fee Alert</h4>
                    <p className="text-orange-700 text-sm">
                      Detected $12 in ATM fees this month. Consider using in-network ATMs to avoid charges.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Show details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
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