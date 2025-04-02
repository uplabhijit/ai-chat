import { PlusIcon, FolderArrowDownIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { generateId } from '../utils/storage'

export default function ChatList({ 
  chats, 
  activeChat, 
  onChatSelect, 
  onNewChat, 
  onImportChat,
  onExportChat,
  onRenameChat,
  onDeleteChat 
}) {
  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      onImportChat(file)
    }
    e.target.value = '' // Reset input
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-700">Chats</h2>
          <div className="flex items-center space-x-2">
            {/* Import button */}
            <label className="p-2 text-gray-500 hover:text-gray-700 cursor-pointer rounded-lg hover:bg-gray-100 transition-colors">
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
              <ArrowUpTrayIcon className="h-5 w-5" />
            </label>
            {/* New chat button */}
            <button
              onClick={onNewChat}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer mb-1 ${
              activeChat?.id === chat.id
                ? 'bg-blue-50 text-blue-600'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => onChatSelect(chat)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <span className="font-medium truncate">{chat.name}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {new Date(chat.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">
                {chat.messages[chat.messages.length - 1]?.content || 'No messages'}
              </p>
            </div>

            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Export button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onExportChat(chat)
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <FolderArrowDownIcon className="h-4 w-4" />
              </button>
              {/* Rename button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const newName = prompt('Enter new name:', chat.name)
                  if (newName && newName !== chat.name) {
                    onRenameChat(chat.id, newName)
                  }
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <span className="text-sm">✎</span>
              </button>
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Are you sure you want to delete this chat?')) {
                    onDeleteChat(chat.id)
                  }
                }}
                className="p-1 text-gray-400 hover:text-red-600 rounded"
              >
                <span className="text-sm">×</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 