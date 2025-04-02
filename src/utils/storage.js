const STORAGE_KEYS = {
  CHATS: 'ollama-chats',
  ACTIVE_CHAT: 'ollama-active-chat',
  SETTINGS: 'ollama-settings'
}

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const saveChats = (chats) => {
  localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats))
}

export const loadChats = () => {
  const chats = localStorage.getItem(STORAGE_KEYS.CHATS)
  return chats ? JSON.parse(chats) : []
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
  const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS)
  return settings ? JSON.parse(settings) : null
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