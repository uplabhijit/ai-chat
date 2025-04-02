const STORAGE_KEYS = {
  CHATS: 'ollama-chats',
  ACTIVE_CHAT: 'ollama-active-chat',
  SETTINGS: 'ollama-settings',
  BACKUP: 'ollama-backup',
  LAST_BACKUP: 'ollama-last-backup'
}

const MAX_CHATS = 100 // Maximum number of chats to store
const MAX_MESSAGES_PER_CHAT = 100 // Maximum number of messages per chat
const BACKUP_INTERVAL = 1000 * 60 * 5 // 5 minutes
const MAX_STORAGE_SIZE = 1024 * 1024 * 10 // 10MB

// Summary configuration
const SUMMARY_STYLES = {
  BRIEF: 'brief',
  DETAILED: 'detailed',
  TOPIC_BASED: 'topic-based',
  CUSTOM: 'custom'
}

const SUMMARY_PROMPTS = {
  [SUMMARY_STYLES.BRIEF]: 'Please provide a brief summary of this conversation, focusing on the key points:',
  [SUMMARY_STYLES.DETAILED]: 'Please provide a detailed summary of this conversation, including all major points and their context:',
  [SUMMARY_STYLES.TOPIC_BASED]: 'Please analyze this conversation and provide a summary organized by main topics discussed:',
  [SUMMARY_STYLES.CUSTOM]: '' // Will be filled by user input
}

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const saveChats = (chats) => {
  // Trim chats if they exceed the limit
  const trimmedChats = chats.slice(-MAX_CHATS).map(chat => ({
    ...chat,
    messages: chat.messages.slice(-MAX_MESSAGES_PER_CHAT)
  }))
  
  try {
    const chatData = JSON.stringify(trimmedChats)
    if (chatData.length > MAX_STORAGE_SIZE) {
      throw new Error('Storage limit exceeded')
    }
    localStorage.setItem(STORAGE_KEYS.CHATS, chatData)
    createBackup(trimmedChats) // Create backup after successful save
  } catch (error) {
    console.error('Error saving chats:', error)
    // If storage is full, remove oldest chats until it fits
    if (error.name === 'QuotaExceededError' || error.message === 'Storage limit exceeded') {
      const reducedChats = trimmedChats
        .slice(-Math.floor(trimmedChats.length / 2)) // Remove oldest half
        .map(chat => ({
          ...chat,
          messages: chat.messages.slice(-50) // Keep only last 50 messages
        }))
      localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(reducedChats))
      return reducedChats
    }
  }
  return trimmedChats
}

export const loadChats = () => {
  try {
    const chats = localStorage.getItem(STORAGE_KEYS.CHATS)
    const parsedChats = chats ? JSON.parse(chats) : []
    // Sort chats by most recent first
    return parsedChats.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (error) {
    console.error('Error loading chats:', error)
    // If main storage is corrupted, try loading from backup
    return loadBackup() || []
  }
}

export const saveActiveChat = (chatId) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, chatId)
}

export const loadActiveChat = () => {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT)
}

export const saveSettings = (settings) => {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
}

export const loadSettings = () => {
  try {
    const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    return settings ? JSON.parse(settings) : null
  } catch (error) {
    console.error('Error loading settings:', error)
    return null
  }
}

// Backup functionality
const createBackup = (chats) => {
  const lastBackup = localStorage.getItem(STORAGE_KEYS.LAST_BACKUP)
  const now = Date.now()
  
  // Only create backup if enough time has passed
  if (!lastBackup || now - parseInt(lastBackup) > BACKUP_INTERVAL) {
    try {
      localStorage.setItem(STORAGE_KEYS.BACKUP, JSON.stringify(chats))
      localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, now.toString())
    } catch (error) {
      console.error('Error creating backup:', error)
    }
  }
}

const loadBackup = () => {
  try {
    const backup = localStorage.getItem(STORAGE_KEYS.BACKUP)
    return backup ? JSON.parse(backup) : null
  } catch (error) {
    console.error('Error loading backup:', error)
    return null
  }
}

export const exportAllChats = () => {
  try {
    const chats = loadChats()
    const settings = loadSettings()
    const exportData = {
      chats,
      settings,
      exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ollama-chats-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting all chats:', error)
    throw new Error('Failed to export chats')
  }
}

export const importAllChats = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        // Validate data structure
        if (!Array.isArray(data.chats)) {
          throw new Error('Invalid backup file format')
        }
        // Save imported data
        localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(data.chats))
        if (data.settings) {
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings))
        }
        resolve(data)
      } catch (error) {
        reject(new Error('Failed to parse backup file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read backup file'))
    reader.readAsText(file)
  })
}

export const exportChat = (chat) => {
  const blob = new Blob([JSON.stringify(chat, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chat-${chat.id}-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const importChat = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const chat = JSON.parse(e.target.result)
        // Validate chat structure
        if (!chat.id || !chat.name || !Array.isArray(chat.messages)) {
          throw new Error('Invalid chat file format')
        }
        resolve(chat)
      } catch (error) {
        reject(new Error('Failed to parse chat file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read chat file'))
    reader.readAsText(file)
  })
}

export const clearAllData = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    return true
  } catch (error) {
    console.error('Error clearing data:', error)
    return false
  }
}

export const getStorageStats = () => {
  const stats = {
    totalChats: 0,
    totalMessages: 0,
    storageUsed: 0,
    storageLimit: MAX_STORAGE_SIZE,
    lastBackup: localStorage.getItem(STORAGE_KEYS.LAST_BACKUP)
  }

  try {
    const chats = loadChats()
    stats.totalChats = chats.length
    stats.totalMessages = chats.reduce((total, chat) => total + chat.messages.length, 0)
    stats.storageUsed = new Blob([JSON.stringify(chats)]).size
  } catch (error) {
    console.error('Error getting storage stats:', error)
  }

  return stats
}

// Add summary history to chat structure
export const addSummaryToHistory = (chat, summary) => {
  if (!chat.summaryHistory) {
    chat.summaryHistory = [];
  }
  chat.summaryHistory.push({
    ...summary,
    timestamp: Date.now()
  });
  // Keep only last 5 summaries
  chat.summaryHistory = chat.summaryHistory.slice(-5);
  return chat;
};

// Generate a summary of chat history
export const generateChatSummary = async (messages, style = SUMMARY_STYLES.BRIEF, model = 'llama3.2', customPrompt = '') => {
  try {
    const prompt = style === SUMMARY_STYLES.CUSTOM && customPrompt 
      ? customPrompt 
      : SUMMARY_PROMPTS[style];

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: `${prompt}\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`,
        stream: false,
        context: []
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate summary');
    }

    const data = await response.json();
    return {
      content: data.response,
      style,
      customPrompt: style === SUMMARY_STYLES.CUSTOM ? customPrompt : undefined,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    return null;
  }
}; 