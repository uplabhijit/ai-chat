import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, Cog6ToothIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/solid'
import ReactMarkdown from 'react-markdown'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [availableModels, setAvailableModels] = useState([])
  const [selectedModel, setSelectedModel] = useState("llama3.2:latest")
  const [showSettings, setShowSettings] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const messagesEndRef = useRef(null)
  const abortControllerRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Cleanup function for ongoing requests
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/tags')
        if (response.ok) {
          const data = await response.json()
          setAvailableModels(data.models || [])
          if (data.models?.length > 0) {
            setSelectedModel(data.models[0].name)
          }
        }
      } catch (e) {
        console.warn('Failed to fetch models:', e)
      }
    }
    fetchModels()
  }, [])

  // Check if Ollama is running
  useEffect(() => {
    const checkOllama = async () => {
      try {
        const response = await fetch('/api/version')
        if (!response.ok) {
          setError('Ollama server is not running. Please start Ollama first.')
        } else {
          setError(null)
        }
      } catch (e) {
        setError('Cannot connect to Ollama server. Please make sure Ollama is running.')
      }
    }
    checkOllama()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)
    setError(null)

    const requestBody = {
      model: selectedModel,
      prompt: userMessage,
      options: {
        temperature: parseFloat(temperature)
      }
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        setError('Request timed out. The model is taking too long to respond.')
        setIsLoading(false)
      }
    }, 30000) // 30 second timeout

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Unknown error occurred'
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error && errorJson.error.includes('model')) {
            errorMessage = `Model error: ${errorJson.error}. Try running 'ollama list' to see available models.`
          } else {
            errorMessage = errorJson.error || errorText
          }
        } catch {
          if (response.status === 404) {
            errorMessage = 'Cannot connect to Ollama API. Please check if Ollama is running.'
          } else if (response.status === 500) {
            errorMessage = 'Ollama server error. Please check server logs.'
          } else {
            errorMessage = errorText
          }
        }
        throw new Error(errorMessage)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        clearTimeout(timeoutId)

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line)
              if (json.error) {
                throw new Error(json.error)
              }
              if (json.response) {
                fullResponse += json.response
                setMessages(prev => {
                  const newMessages = [...prev]
                  if (newMessages[newMessages.length - 1]?.role === 'assistant') {
                    newMessages[newMessages.length - 1].content = fullResponse
                  } else {
                    newMessages.push({ role: 'assistant', content: fullResponse })
                  }
                  return newMessages
                })
              }
            } catch (e) {
              console.warn('Error parsing response chunk:', e)
            }
          }
        }
      }

    } catch (error) {
      let errorMessage = error.message || 'Sorry, there was an error processing your request.'
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request was cancelled.'
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Could not connect to Ollama. Please check:\n1. Is Ollama running?\n2. Is the model installed?'
      }
      
      setError(errorMessage)
      setMessages(prev => [...prev, { role: 'error', content: errorMessage }])
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const refreshModels = async () => {
    try {
      const response = await fetch('/api/tags')
      if (response.ok) {
        const data = await response.json()
        setAvailableModels(data.models || [])
      }
    } catch (e) {
      console.warn('Failed to refresh models:', e)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">Ollama Chat</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="text-sm text-gray-600">
                  {error ? 'Disconnected' : 'Connected'}
                </span>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Cog6ToothIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          {showSettings && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Model</label>
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1"
                    >
                      {availableModels.map(model => (
                        <option key={model.name} value={model.name}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={refreshModels}
                      className="p-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Temperature</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-gray-600 w-12 text-right">{temperature}</span>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Chat History</label>
                  <button
                    onClick={clearChat}
                    className="flex items-center space-x-1 px-2 py-1 text-sm text-red-600 hover:text-red-700 rounded hover:bg-red-50 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span>Clear Chat</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      </header>

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden bg-white">
        <div className="h-full max-w-4xl mx-auto px-4">
          <div className="h-full overflow-y-auto py-4 space-y-6" style={{ scrollbarWidth: 'thin' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <PaperAirplaneIcon className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-lg font-medium">Welcome to Ollama Chat!</p>
                  <p className="text-sm">Start a conversation by typing a message below.</p>
                </div>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.role === 'error'
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.role === 'user' || message.role === 'error' ? (
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        components={{
                          pre: ({ node, ...props }) => (
                            <div className="overflow-auto rounded-lg bg-gray-800 p-4 my-2">
                              <pre {...props} />
                            </div>
                          ),
                          code: ({ node, inline, ...props }) => (
                            inline ? 
                              <code className="bg-gray-200 text-gray-800 rounded px-1 py-0.5 text-sm" {...props} /> :
                              <code className="text-gray-100 text-sm" {...props} />
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3 text-gray-800 flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <button 
                    onClick={handleCancel}
                    className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App 