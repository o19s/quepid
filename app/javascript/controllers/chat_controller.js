import { Controller } from "@hotwired/stimulus"
import consumer from "../channels/consumer"

export default class extends Controller {
  static targets = ["messageInput"]
  
  connect() {
    this.currentMessageElement = null
    this.conversationId = this.generateConversationId()
    this.chunkBuffer = new Map() // Buffer for out-of-order chunks
    this.nextExpectedSequence = 0
    this.debugMode = false // Set to true to enable chunk debugging
    this.connectionError = false
    
    this.subscription = consumer.subscriptions.create(
      { 
        channel: "ChatChannel"
      },
      {
        connected: () => {
          console.log("Connected to ChatChannel")
          this.connectionError = false
        },
        
        disconnected: () => {
          console.log("Disconnected from ChatChannel")
        },
        
        rejected: () => {
          console.error("ChatChannel subscription rejected - user not authenticated")
          this.connectionError = true
          this.showConnectionError()
        },
        
        received: (data) => {
          this.handleReceivedData(data)
        }
      }
    )
  }
  
  disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe()
    }
  }
  
  toggle() {
    const panel = document.getElementById('chatPanel')
    const toggleBtn = document.getElementById('chatToggle')
    
    panel.classList.toggle('show')
    toggleBtn.classList.toggle('hidden')
  }
  
  close() {
    const panel = document.getElementById('chatPanel')
    const toggleBtn = document.getElementById('chatToggle')
    
    panel.classList.remove('show')
    toggleBtn.classList.remove('hidden')
  }
  
  sendMessage(event) {
    event.preventDefault()
    
    const message = this.messageInputTarget.value.trim()
    if (message === '') return
    
    // Check if connection is valid
    if (this.connectionError) {
      this.showConnectionError()
      return
    }
    
    // Send message through ActionCable
    this.subscription.send({ 
      message: message,
      conversation_id: this.conversationId 
    })
    
    // Clear input
    this.messageInputTarget.value = ''
  }
  
  showConnectionError() {
    const messagesContainer = document.getElementById('chatMessages')
    
    // Clear any existing content
    messagesContainer.innerHTML = `
      <div class="alert alert-danger m-3" role="alert">
        <h6 class="alert-heading">Connection Error</h6>
        <p class="mb-0">Unable to connect to chat service. Please ensure you are logged in and refresh the page.</p>
      </div>
    `
  }
  
  handleReceivedData(data) {
    if (data.sender === 'user') {
      // Display user message
      this.addMessageToChat(data.message, 'user')
    } else if (data.sender === 'assistant') {
      if (data.stream_start) {
        // Start a new assistant message
        this.currentMessageElement = this.addMessageToChat('', 'assistant', true)
        this.nextExpectedSequence = 0
        this.chunkBuffer.clear()
      } else if (data.stream_chunk) {
        // Handle chunk with sequence ordering
        this.handleStreamChunk(data.stream_chunk, data.chunk_sequence)
      } else if (data.stream_end) {
        // Process any remaining buffered chunks
        this.flushRemainingChunks()
        
        // Log if we're missing any chunks
        if (data.total_chunks && this.nextExpectedSequence < data.total_chunks) {
          console.warn(`Missing chunks: received ${this.nextExpectedSequence} of ${data.total_chunks} chunks`)
          // Optionally show incomplete message indicator
          if (this.currentMessageElement) {
            const bubble = this.currentMessageElement.querySelector('.message-bubble')
            bubble.innerHTML += ' <small class="text-muted">[incomplete]</small>'
          }
        }
        
        // Remove streaming indicator
        if (this.currentMessageElement) {
          const bubble = this.currentMessageElement.querySelector('.message-bubble')
          bubble.classList.remove('streaming')
        }
        
        // Streaming completed
        this.currentMessageElement = null
        this.nextExpectedSequence = 0
        this.chunkBuffer.clear()
      } else if (data.error) {
        // Display error message
        this.addMessageToChat(data.error, 'assistant')
      }
    }
  }
  
  handleStreamChunk(chunk, sequence) {
    if (this.debugMode) {
      console.log(`Received chunk ${sequence}: "${chunk}" (expecting ${this.nextExpectedSequence})`)
    }
    
    if (sequence === undefined || sequence === this.nextExpectedSequence) {
      // This is the chunk we're expecting, append it
      this.appendChunkToMessage(chunk)
      this.nextExpectedSequence++
      
      // Check if we have any buffered chunks that can now be processed
      while (this.chunkBuffer.has(this.nextExpectedSequence)) {
        const bufferedChunk = this.chunkBuffer.get(this.nextExpectedSequence)
        if (this.debugMode) {
          console.log(`Processing buffered chunk ${this.nextExpectedSequence}: "${bufferedChunk}"`)
        }
        this.appendChunkToMessage(bufferedChunk)
        this.chunkBuffer.delete(this.nextExpectedSequence)
        this.nextExpectedSequence++
      }
    } else if (sequence > this.nextExpectedSequence) {
      // This chunk arrived out of order, buffer it
      this.chunkBuffer.set(sequence, chunk)
      if (this.debugMode) {
        console.log(`Buffering out-of-order chunk ${sequence}, expecting ${this.nextExpectedSequence}`)
      }
    } else if (this.debugMode && sequence < this.nextExpectedSequence) {
      console.log(`Ignoring duplicate/late chunk ${sequence}`)
    }
  }
  
  appendChunkToMessage(chunk) {
    if (this.currentMessageElement && chunk) {
      const bubble = this.currentMessageElement.querySelector('.message-bubble')
      bubble.textContent += chunk
      this.scrollToBottom()
    }
  }
  
  flushRemainingChunks() {
    // Process any remaining buffered chunks in order
    const sortedSequences = Array.from(this.chunkBuffer.keys()).sort((a, b) => a - b)
    for (const sequence of sortedSequences) {
      if (sequence >= this.nextExpectedSequence) {
        const chunk = this.chunkBuffer.get(sequence)
        this.appendChunkToMessage(chunk)
        this.nextExpectedSequence = sequence + 1
      }
    }
  }
  
  addMessageToChat(message, sender, isStreaming = false) {
    const messagesContainer = document.getElementById('chatMessages')
    
    // Remove the welcome message if it exists
    const welcomeMessage = messagesContainer.querySelector('.text-center')
    if (welcomeMessage) {
      welcomeMessage.remove()
    }
    
    const messageElement = document.createElement('div')
    messageElement.className = `chat-message ${sender}`
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    messageElement.innerHTML = `
      <div class="message-content">
        <div class="message-bubble${isStreaming ? ' streaming' : ''}">
          ${this.escapeHtml(message)}
        </div>
        <div class="message-time">${time}</div>
      </div>
    `
    
    messagesContainer.appendChild(messageElement)
    this.scrollToBottom()
    
    return messageElement
  }
  
  scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages')
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }
  
  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
  
  generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}