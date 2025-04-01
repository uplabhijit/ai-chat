import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import ReactMarkdown from 'react-markdown'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const abortControllerRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Cleanup function for ongoing requests
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
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
      model: "llama3.2:latest",
      prompt: userMessage
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
      console.log('Sending request to Ollama:', requestBody)
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
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })

        let errorMessage = 'Unknown error occurred'
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error && errorJson.error.includes('model')) {
            errorMessage = `Model error: ${errorJson.error}. Try running 'ollama list' to see available models.`
          } else {
            errorMessage = errorJson.error || errorText
          }
        } catch {
          // If error text is not JSON
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

      // Handle streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''
      let lastUpdateTime = Date.now()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        // Reset timeout on each chunk
        clearTimeout(timeoutId)
        lastUpdateTime = Date.now()

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
                // Update the message in real-time as we receive chunks
                setMessages(prev => {
                  const newMessages = [...prev]
                  // Update or add the assistant's message
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
              console.warn('Problematic chunk:', line)
            }
          }
        }
      }

    } catch (error) {
      console.error('Error details:', error)
      let errorMessage = error.message || 'Sorry, there was an error processing your request.'
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request was cancelled due to timeout. Please try again.'
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Could not connect to Ollama. Please check:\n1. Is Ollama running? Try running "ollama list"\n2. Is the model installed? Try running "ollama pull llama3.2:latest"'
      } else if (error.message.includes('model')) {
        errorMessage = `${error.message}\nTry running "ollama list" to see available models or "ollama pull llama3.2:latest" to install the model.`
      }
      
      setError(errorMessage)
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }])
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setError('Request cancelled by user.')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <header className="text-center py-4">
        <h1 className="text-2xl font-bold text-gray-800">Ollama Chat</h1>
        {error && (
          <div className="mt-2 p-2 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.content.startsWith('Error:')
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-200 text-gray-800'
              }`}
            >
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : message.content.startsWith('Error:') ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown
                    components={{
                      pre: ({ node, ...props }) => (
                        <div className="overflow-auto rounded-md bg-gray-800 p-4 my-2">
                          <pre {...props} />
                        </div>
                      ),
                      code: ({ node, inline, ...props }) => (
                        inline ? 
                          <code className="bg-gray-700 text-gray-100 rounded px-1" {...props} /> :
                          <code className="text-gray-100" {...props} />
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
            <div className="bg-gray-200 rounded-lg p-4 text-gray-800 flex items-center gap-2">
              <span>Thinking...</span>
              <button 
                onClick={handleCancel}
                className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </form>
    </div>
  )
}

export default App 